import os
import json
import requests
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import fitz # PyMuPDF for PDF text extraction
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
# This is crucial for securing sessions.
# Use environment variable for production, fallback for development
app.secret_key = os.environ.get('SECRET_KEY', 'your_long_secure_secret_key') 

# --- Groq API Configuration ---
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
API_URL = "https://api.groq.com/openai/v1/chat/completions"

# --- Utility Functions ---

def get_pdf_text(uploaded_file):
    """Extracts text from a Flask uploaded PDF file stream."""
    try:
        uploaded_file.seek(0) 
        pdf_file = uploaded_file.read() 
        doc = fitz.open(stream=pdf_file, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        print(f"Error processing PDF: {e}")
        return None

def generate_quiz_data(content_text, num_questions, difficulty):
    """Generates quiz data using the Groq API."""
    if not GROQ_API_KEY:
        return {"error": "Groq API Key is missing. Please set the 'GROQ_API_KEY' environment variable in your .env file."}

    # Content length check for meaningful content
    if not content_text or len(content_text.strip()) < 50:
        return {"error": "Content is too short or empty. Please provide at least 50 characters of text or a valid PDF."}

    # System Prompt 
    system_prompt = f"""
    You are an expert quiz generator. Your task is to analyze the provided text content
    and generate a quiz of exactly {num_questions} multiple-choice questions.
    The quiz must be of '{difficulty}' difficulty. Ensure every question has 4 unique options, 
    one of which is marked as isCorrect: true.
    Return ONLY a JSON object with a single key "questions", which is an array of question objects.
    Each question object must have: "question", "answerOptions" (array of 4 objects with "text", "rationale", "isCorrect"), and "hint".
    """ 

    user_prompt = f"Content for Quiz Generation (Limited to first 15000 characters):\n---\n{content_text[:15000]}\n---"

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {GROQ_API_KEY}'
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=60)
        
        if response.status_code >= 400:
            print(f"--- API Error DEBUG (Status {response.status_code}) ---")
            print(f"Error Details: {response.text}")
            return {"error": f"API Request Error: {response.status_code}. Please check your API key."}

        # Successful response processing
        result = response.json()
        content_text = result['choices'][0]['message']['content']
        quiz_data = json.loads(content_text)
        
        # Ensure it has 'questions' key
        if 'questions' not in quiz_data and isinstance(quiz_data, list):
             quiz_data = {"questions": quiz_data}
        elif 'questions' not in quiz_data:
             # Try to find an array in the object
             for val in quiz_data.values():
                 if isinstance(val, list):
                     quiz_data = {"questions": val}
                     break
        
        if 'questions' not in quiz_data:
            return {"error": "The AI returned an invalid response structure."}

        return {"success": True, "quiz": quiz_data['questions']}

    except requests.exceptions.RequestException as e:
        error_msg = f"API Request Error: {e}"
        print(error_msg)
        return {"error": error_msg}
    except (json.JSONDecodeError, KeyError) as e:
        print(f"API returned invalid data or JSON structure: {e}")
        return {"error": "The AI returned an invalid response structure. Please try again."}


# --- Flask Routes ---

@app.route('/', methods=['GET', 'POST'])
def index():
    error = None
    
    if request.method == 'POST':
        # 1. Get form inputs
        uploaded_file = request.files.get('file_upload')
        pasted_text = request.form.get('pasted_text', '').strip()
        num_questions = int(request.form.get('num_questions', 5))
        difficulty_level = request.form.get('difficulty_level', 'Medium')
        
        content_text = None
        
        # Determine source content and save it to session for persistence
        if uploaded_file and uploaded_file.filename != '':
            content_text = get_pdf_text(uploaded_file)
            session['quiz_source_name'] = uploaded_file.filename
            session['quiz_source_text'] = content_text
            session['pasted_text'] = "" 
        elif pasted_text:
            content_text = pasted_text
            session['pasted_text'] = pasted_text
            session['quiz_source_text'] = pasted_text
            session['quiz_source_name'] = None 
        elif session.get('quiz_source_text'):
            # Use content already in session (for subsequent quiz generations without new input)
            content_text = session['quiz_source_text']
            
        # Save general config inputs to session for sticky form behavior
        session['num_questions'] = num_questions
        session['difficulty_level'] = difficulty_level

        if not content_text:
            error = "Please upload a file or paste text content to generate a quiz."
        else:
            # 2. Call the API using the content_text
            result = generate_quiz_data(content_text, num_questions, difficulty_level)
            
            if result.get("success"):
                # 3. Save quiz data to session
                session['quiz_generated'] = True
                session['current_quiz'] = result['quiz']
                session['user_answers'] = {str(i): None for i in range(len(result['quiz']))}
                session['quiz_submitted'] = False
                session['score'] = 0
                
                return redirect(url_for('index'))
            else:
                # If API call fails, display the error and keep the user on the page
                error = result.get("error", "Failed to generate quiz due to an unknown error.")

    # GET request or POST with error
    return render_template('index.html', error=error)

@app.route('/submit_quiz', methods=['POST'])
def submit_quiz():
    """API endpoint for the JavaScript to submit answers and get score."""
    if not session.get('quiz_generated'):
        return jsonify({"success": False, "error": "No quiz is active."}), 400

    try:
        data = request.get_json()
        user_selections = data.get('answers', {}) 
        quiz_data = session['current_quiz']
        
        correct_count = 0
        user_answers_indices = {} 
        
        for i, question in enumerate(quiz_data):
            q_index_str = str(i)
            selected_text = user_selections.get(q_index_str)
            
            selected_index = None
            if selected_text:
                for j, option in enumerate(question['answerOptions']):
                    if option['text'] == selected_text:
                        selected_index = j
                        break
            
            user_answers_indices[q_index_str] = selected_index

            if selected_index is not None and question['answerOptions'][selected_index]['isCorrect']:
                correct_count += 1

        # Save final state to session
        session['user_answers'] = user_answers_indices
        session['score'] = correct_count
        session['quiz_submitted'] = True
        
        return jsonify({"success": True, "score": correct_count})

    except Exception as e:
        print(f"Error during quiz submission: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/reset_quiz')
def reset_quiz():
    """
    Clears session data to return the app to the initial state (Home).
    """
    session.pop('quiz_generated', None)
    session.pop('current_quiz', None)
    session.pop('user_answers', None)
    session.pop('quiz_submitted', None)
    session.pop('score', None)
    
    # Clear source content and config
    session.pop('pasted_text', None) 
    session.pop('quiz_source_text', None)
    session.pop('quiz_source_name', None)
    session.pop('num_questions', None)
    session.pop('difficulty_level', None)
    
    return redirect(url_for('index'))

if __name__ == '__main__':
    # Run in debug mode locally, production server (gunicorn) handles deployment
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)