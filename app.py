import os
import json
import requests
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import fitz # PyMuPDF for PDF text extraction

app = Flask(__name__)
# This is crucial for securing sessions.
app.secret_key = 'your_long_secure_secret_key' 

# --- Gemini API Configuration ---
API_KEY = os.environ.get("GEMINI_API_KEY")

# 2. Fallback check: IF YOU HARDCODE, YOU MUST REPLACE THIS STRING
if not API_KEY:
    API_KEY = "YOUR_GEMINI_API_KEY_HERE" 

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent"

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
    """Generates quiz data using the Gemini API."""
    if not API_KEY or API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        return {"error": "Gemini API Key is missing or incorrectly configured. Please set the 'GEMINI_API_KEY' environment variable or replace the placeholder in app.py."}

    # Content length check for meaningful content
    if not content_text or len(content_text.strip()) < 50:
        return {"error": "Content is too short or empty. Please provide at least 50 characters of text or a valid PDF."}

    # System Prompt 
    system_prompt = f"""
    You are an expert quiz generator. Your task is to analyze the provided text content
    and generate a quiz of exactly {num_questions} multiple-choice questions.
    The quiz must be of '{difficulty}' difficulty. Ensure every question has 4 unique options, 
    one of which is marked as isCorrect: true. The response MUST strictly adhere to the provided JSON schema.
    
    Content for Quiz Generation (Limited to first 20000 characters):
    ---
    {content_text[:20000]}
    ---
    """ 

    # JSON Schema for structured output
    quiz_schema = {
        "type": "OBJECT",
        "properties": {
            "questions": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "question": {"type": "STRING"},
                        "answerOptions": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "text": {"type": "STRING"},
                                    "rationale": {"type": "STRING"},
                                    "isCorrect": {"type": "BOOLEAN"}
                                },
                                "required": ["text", "rationale", "isCorrect"]
                            }
                        },
                        "hint": {"type": "STRING"} 
                    },
                    "required": ["question", "answerOptions", "hint"]
                }
            }
        },
        "required": ["questions"]
    }

    payload = {
        "contents": [{"parts": [{"text": "Generate the quiz based on the instructions."}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": { 
            "responseMimeType": "application/json",
            "responseSchema": quiz_schema
        }
    }
    
    headers = {'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY}

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=60)
        
        # Comprehensive Error Logging
        if response.status_code >= 400:
            print(f"--- API Error DEBUG (Status {response.status_code}) ---")
            try:
                error_details = response.json()
                print(f"Error Details: {json.dumps(error_details, indent=2)}")
                if 'error' in error_details and 'message' in error_details['error']:
                    # Return specific error message from the API response body
                    return {"error": f"API Request Error: {response.status_code}. Detail: {error_details['error']['message']}"}
            except json.JSONDecodeError:
                print(f"Raw Response Text: {response.text[:200]}...")
            
            response.raise_for_status() 

        # Successful response processing
        result = response.json()
        
        json_text = result['candidates'][0]['content']['parts'][0]['text']
        quiz_data = json.loads(json_text)
        
        return {"success": True, "quiz": quiz_data['questions']}

    except requests.exceptions.RequestException as e:
        error_msg = f"API Request Error: {e}"
        print(f"--- Final Request Exception ---")
        print(error_msg)
        return {"error": error_msg}
    except (json.JSONDecodeError, KeyError) as e:
        print(f"--- JSON/KeyError ---")
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
    app.run(debug=True)