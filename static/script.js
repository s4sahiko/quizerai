document.addEventListener('DOMContentLoaded', function() {
    const questionsContainer = document.getElementById('questions-container');
    const quizForm = document.getElementById('quiz-form');
    const mainWrapper = document.getElementById('main-wrapper');
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const toggleIcon = document.getElementById('toggle-icon');
    const toggleText = document.getElementById('toggle-text');
    
    // --- NEW LOADER ELEMENTS ---
    const generationForm = document.getElementById('quiz-generation-form');
    const mainContent = document.getElementById('main-content');
    const generateQuizBtn = document.getElementById('generate-quiz-btn');
    // ---------------------------
    
    // --- Custom Dropdown Elements
    const difficultyDropdownButton = document.getElementById('difficultyDropdownButton');
    const difficultyHiddenInput = document.getElementById('difficulty_level'); 
    const difficultyOptions = document.querySelectorAll('.difficulty-select-option');
    // ---------------------------------
    
    // --- File Upload Elements ---
    const fileUploadInput = document.getElementById('file_upload');
    const filePlaceholder = document.getElementById('file-upload-placeholder');
    // ---------------------------------

    let userSelections = {}; 
    
    // Function to apply the correct color class to the button and hidden input
    function updateDifficultyVisuals(value) {
        const lowerValue = value.toLowerCase();
        
        if (!difficultyDropdownButton || !difficultyHiddenInput) return;

        // 1. Update Hidden Input Value (Used for Form Submission)
        difficultyHiddenInput.value = value;
        
        // 2. Update Button Text and Value Attribute
        difficultyDropdownButton.textContent = value;
        difficultyDropdownButton.dataset.selectedValue = value;

        // 3. Update Button Classes for Styling 
        difficultyDropdownButton.classList.remove('difficulty-low', 'difficulty-medium', 'difficulty-high');
        difficultyDropdownButton.classList.add(`difficulty-${lowerValue}`);

        // 4. Update Menu Item Active State 
        difficultyOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.value === value) {
                option.classList.add('active');
            }
        });
    }

    // Event listener for when an item in the custom menu is clicked
    difficultyOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            const selectedValue = this.dataset.value;
            updateDifficultyVisuals(selectedValue);
        });
    });

    // Initialize state on load
    if (difficultyDropdownButton && difficultyHiddenInput) {
        updateDifficultyVisuals(difficultyHiddenInput.value || 'Low'); 
    }
    // --- END Difficulty Dropdown Custom Logic ---
    
    
    // --- Sidebar Toggle Logic ---
    
    function isMobileView() {
        return window.matchMedia("(max-width: 768px)").matches;
    }

    function updateToggleVisuals() {
        if (isMobileView()) {
            const isVisible = sidebar.classList.contains('collapsed');
            if (isVisible) {
                toggleIcon.className = 'fas fa-chevron-left me-1';
                toggleText.textContent = 'Hide Panel';
            } else {
                toggleIcon.className = 'fas fa-chevron-right me-1';
                toggleText.textContent = 'Show Panel';
            }
        } else {
            const isHidden = mainWrapper.classList.contains('sidebar-hidden'); 
            if (isHidden) {
                toggleIcon.className = 'fas fa-chevron-right me-1';
                toggleText.textContent = 'Show Panel';
            } else {
                toggleIcon.className = 'fas fa-chevron-left me-1';
                toggleText.textContent = 'Hide Panel';
            }
        }
    }

    if (toggleSidebarBtn) {
        updateToggleVisuals();
        
        toggleSidebarBtn.addEventListener('click', function() {
            if (isMobileView()) {
                sidebar.classList.toggle('collapsed');
            } else {
                mainWrapper.classList.toggle('sidebar-hidden');
            }
            updateToggleVisuals();
        });
        
        window.addEventListener('resize', updateToggleVisuals);
    }
    
    
    // --- Quiz Generation Submission & Loader Logic 
    if (generationForm && mainContent && generateQuizBtn) {
        generationForm.addEventListener('submit', function(e) {
            
            // 1. Apply loading state to main-content (triggers blur and shows overlay)
            mainContent.classList.add('loading');
            
            // 2. Visually update the button to show a spinner and disable it
            generateQuizBtn.disabled = true;
            generateQuizBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Generating...';
            
            // Allow the form to submit normally
        });
    }
    // --- END Quiz Generation Submission & Loader Logic ---


    
    // --- File Upload Handler ---
    if (fileUploadInput && filePlaceholder) {
        fileUploadInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                filePlaceholder.innerHTML = `<i class="fas fa-check-circle me-2 text-white"></i> File Selected: <b>${this.files[0].name}</b>`;
                filePlaceholder.classList.add('file-selected');
            } else {
                filePlaceholder.innerHTML = `<i class="fas fa-file-upload me-2"></i> <span>Click or Drag a PDF here</span>`;
                filePlaceholder.classList.remove('file-selected');
            }
        });
    }

    // --- Data Initialization 
    if (typeof QUIZ_DATA !== 'undefined' && typeof USER_ANSWERS !== 'undefined') {
        QUIZ_DATA.forEach((q, i) => {
            const selectedIndex = USER_ANSWERS[i.toString()];
            if (selectedIndex !== null && selectedIndex !== undefined) {
                userSelections[i] = q.answerOptions[selectedIndex].text;
            }
        });
    }

    // --- Core Rendering Function 
    function renderQuiz() {
        if (!QUIZ_DATA || QUIZ_DATA.length === 0) {
            return;
        }

        questionsContainer.innerHTML = ''; 

        QUIZ_DATA.forEach((question, qIndex) => {
            const card = document.createElement('div');
            card.className = 'question-card';
            
            card.innerHTML += `<div class="question-text">${qIndex + 1}. ${question.question}</div>`;

            question.answerOptions.forEach((option) => {
                const isCorrect = option.isCorrect;
                const isSelected = userSelections[qIndex] === option.text;

                let cssClass = 'option-box';
                let iconHTML = ''; 
                
                if (typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED) {
                    if (isCorrect) {
                        cssClass += ' correct';
                        iconHTML = '<i class="fas fa-check-circle"></i> ';
                    } else if (isSelected) {
                        cssClass += ' incorrect';
                        iconHTML = '<i class="fas fa-times-circle"></i> ';
                    } else {
                        iconHTML = '<i class="far fa-circle"></i> ';
                    }
                    
                    card.innerHTML += `<div class="${cssClass}"><b>${iconHTML}</b> ${option.text}</div>`;
                } else {
                    cssClass += isSelected ? ' selected' : '';
                    iconHTML = ''; 

                    const optionHTML = `
                        <label class="${cssClass}" data-q-index="${qIndex}" data-option-text="${option.text}">
                            <input type="radio" name="q_${qIndex}" value="${option.text}" ${isSelected ? 'checked' : ''}>
                            ${option.text}
                        </label>
                    `;
                    card.innerHTML += optionHTML;
                }
            });

            const correctOption = question.answerOptions.find(opt => opt.isCorrect);
            const explanation = `
                <div class="accordion mt-3" id="accordionHint${qIndex}">
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${qIndex}" aria-expanded="false" aria-controls="collapse${qIndex}">
                                ${typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED ? '<i class="fas fa-info-circle"></i> Show Explanation & Rationale' : '<i class="fas fa-lightbulb"></i> Get a Hint'}
                            </button>
                        </h2>
                        <div id="collapse${qIndex}" class="accordion-collapse collapse" data-bs-parent="#accordionHint${qIndex}">
                            <div class="accordion-body">
                                ${typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED ? `<p><strong>Correct Answer Rationale:</strong> ${correctOption.rationale}</p>` : ''}
                                <p><strong>Study Hint:</strong> ${question.hint || 'Hint not available for this question.'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            card.innerHTML += explanation;

            questionsContainer.appendChild(card);
        });
        
        if (typeof IS_SUBMITTED === 'undefined' || !IS_SUBMITTED) {
            attachEventListeners();
        }
    }

    // --- Active Quiz Event Handlers 
    function attachEventListeners() {
        questionsContainer.addEventListener('click', (event) => {
            const optionBox = event.target.closest('.option-box');
            if (optionBox) {
                const radio = optionBox.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    
                    const qIndex = radio.name.split('_')[1];
                    userSelections[qIndex] = radio.value;

                    document.querySelectorAll(`[name="q_${qIndex}"]`).forEach(input => {
                        const label = input.closest('.option-box');
                        label.classList.remove('selected');
                    });
                    optionBox.classList.add('selected');
                }
            }
        });
    }

    // --- Submission Handler 
    if (quizForm) {
        quizForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED) return;

            const submitBtn = document.getElementById('submit-quiz-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';

            fetch('/submit_quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ answers: userSelections })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.reload(); 
                } else {
                    console.error('Submission error from backend:', data.error);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Submission Failed';
                }
            })
            .catch(error => {
                console.error('Network error during submission:', error);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Submission Failed';
            });
        });
    }

    // --- Results Summary Function 
    function renderResultsSummary() {
        const resultsSummary = document.getElementById('results-summary');
        if (!resultsSummary || typeof IS_SUBMITTED === 'undefined' || !IS_SUBMITTED) return;

        const totalQuestions = QUIZ_DATA.length;
        const score = SCORE;
        const percentage = (score / totalQuestions) * 100;
        
        let insight = "Needs Review! Focus on the rationale below.";
        let icon = "times-circle";

        if (percentage >= 80) {
            insight = "Mastery Achieved! You crushed it. 🎉";
            icon = "trophy";
        } else if (percentage >= 50) {
            insight = "Solid Effort! Review your incorrect answers.";
            icon = "check-double";
        }

        const html = `
            <div class="row align-items-center">
                <div class="col-md-4 text-center border-end">
                    <h5 class="text-muted mb-0">Final Score</h5>
                    <h1 class="display-3 text-primary-custom">${score} / ${totalQuestions}</h1>
                    <p class="lead text-success">${percentage.toFixed(1)}%</p>
                </div>
                <div class="col-md-8">
                    <div class="p-3">
                        <h4 class="mb-2 text-primary-custom"><i class="fas fa-${icon}"></i> Learning Insight:</h4>
                        <p class="lead">${insight}</p>
                        <div class="progress" style="height: 15px;">
                            <div class="progress-bar bg-success" role="progressbar" style="width: ${percentage}%" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"></div>
                            <div class="progress-bar bg-danger" role="progressbar" style="width: ${100 - percentage}%" aria-valuenow="${100 - percentage}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <small class="text-muted mt-1 d-block">Correct: ${percentage.toFixed(0)}% | Incorrect: ${(100 - percentage).toFixed(0)}%</small>
                    </div>
                </div>
            </div>
        `;

        resultsSummary.innerHTML = html;
    }


    // --- Application Bootstrapping 
    if (typeof QUIZ_DATA !== 'undefined' && QUIZ_DATA && QUIZ_DATA.length > 0) {
        renderQuiz();
    }
    
    if (typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED) {
        renderResultsSummary();
    }
});