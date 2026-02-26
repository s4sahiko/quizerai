document.addEventListener('DOMContentLoaded', function () {
    const questionsContainer = document.getElementById('questions-container');
    const quizForm = document.getElementById('quiz-form');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const loaderOverlay = document.getElementById('loader-overlay');
    const generationForm = document.getElementById('quiz-generation-form');
    const progressBar = document.getElementById('quiz-progress-bar');
    const progressText = document.getElementById('progress-text');
    const questionCounter = document.getElementById('question-counter');

    // --- Theme Switching ---
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    // --- Sidebar Toggle Logic ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mainWrapper = document.getElementById('main-wrapper');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (sidebarToggle && mainWrapper && sidebar && backdrop) {
        const toggleSidebar = () => {
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                sidebar.classList.toggle('mobile-active');
                backdrop.classList.toggle('active');
                // Force remove desktop hidden class on mobile
                mainWrapper.classList.remove('sidebar-hidden');
            } else {
                mainWrapper.classList.toggle('sidebar-hidden');
                const isHidden = mainWrapper.classList.contains('sidebar-hidden');
                const span = sidebarToggle.querySelector('span');
                const icon = sidebarToggle.querySelector('i');

                if (isHidden) {
                    if (span) span.textContent = 'Show Panel';
                    if (icon) icon.className = 'fas fa-outdent';
                } else {
                    if (span) span.textContent = 'Hide Panel';
                    if (icon) icon.className = 'fas fa-indent';
                }
            }
        };

        sidebarToggle.addEventListener('click', toggleSidebar);
        backdrop.addEventListener('click', toggleSidebar);

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('mobile-active');
                backdrop.classList.remove('active');
            }
        });
    }

    // --- File Upload Name Display ---
    const fileInput = document.getElementById('file_upload');
    const filePlaceholder = document.getElementById('file-upload-placeholder');
    if (fileInput && filePlaceholder) {
        fileInput.addEventListener('change', function () {
            if (this.files && this.files.length > 0) {
                const fileName = this.files[0].name;
                filePlaceholder.innerHTML = `
                    <h6 class="text-primary fw-bold mb-1"><i class="fas fa-file-pdf me-2"></i>Attached</h6>
                    <p class="mb-0 small text-secondary text-truncate">${fileName}</p>
                `;
            } else {
                filePlaceholder.innerHTML = `
                    <h6 class="fw-bold mb-1">Click or Drag PDF</h6>
                    <p class="mb-0 small text-tertiary">Max size 10MB</p>
                `;
            }
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            updateThemeIcon(theme);
        });

        // --- Question Stepper Logic ---
        const qMinusBtn = document.getElementById('q-minus');
        const qPlusBtn = document.getElementById('q-plus');
        const qCountDisplay = document.getElementById('q-count-display');
        const qStepperTrack = document.querySelector('.q-stepper-track');
        const qStepperFill = document.getElementById('q-stepper-fill');
        const qInput = document.getElementById('num_questions');
        if (qMinusBtn && qPlusBtn && qCountDisplay && qStepperTrack && qStepperFill && qInput) {
            const updateStepper = (value) => {
                const max = parseInt(qInput.max) || 25;
                const min = parseInt(qInput.min) || 1;
                const clamped = Math.min(Math.max(value, min), max);
                qInput.value = clamped;
                qCountDisplay.textContent = clamped;
                const percent = ((clamped - min) / (max - min)) * 100;
                qStepperFill.style.width = `${percent}%`;
            };

            let isDragging = false;

            const handleTrackInteraction = (e) => {
                const rect = qStepperTrack.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const x = clientX - rect.left;
                const percent = Math.min(Math.max(x / rect.width, 0), 1);
                const max = parseInt(qInput.max) || 25;
                const min = parseInt(qInput.min) || 1;
                const value = Math.round(min + (max - min) * percent);
                updateStepper(value);
            };

            qMinusBtn.addEventListener('click', () => updateStepper(parseInt(qInput.value) - 1));
            qPlusBtn.addEventListener('click', () => updateStepper(parseInt(qInput.value) + 1));

            // Mouse Interaction
            qStepperTrack.addEventListener('mousedown', (e) => {
                isDragging = true;
                handleTrackInteraction(e);
            });

            window.addEventListener('mousemove', (e) => {
                if (isDragging) handleTrackInteraction(e);
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
            });

            // Touch Interaction
            qStepperTrack.addEventListener('touchstart', (e) => {
                isDragging = true;
                handleTrackInteraction(e);
            }, { passive: true });

            window.addEventListener('touchmove', (e) => {
                if (isDragging) handleTrackInteraction(e);
            }, { passive: true });

            window.addEventListener('touchend', () => {
                isDragging = false;
            });

            // Initialize stepper width
            updateStepper(parseInt(qInput.value));
        }

        // --- Difficulty Pill Logic ---
        const diffPills = document.querySelectorAll('.diff-pill');
        const diffInput = document.getElementById('difficulty_level');
        if (diffPills.length && diffInput) {
            diffPills.forEach(pill => {
                pill.addEventListener('click', () => {
                    diffPills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    diffInput.value = pill.getAttribute('data-value');
                });
            });
        }
    }

    function updateThemeIcon(theme) {
        if (!themeIcon) return;
        themeIcon.className = (theme === 'dark') ? 'fas fa-sun' : 'fas fa-moon';
    }

    // --- Loading Overlay ---
    if (generationForm && loaderOverlay) {
        generationForm.addEventListener('submit', () => {
            loaderOverlay.classList.add('active');
        });
    }

    // --- Quiz Logic State ---
    let userSelections = {};

    // Initialize selections from session if they exist
    if (typeof QUIZ_DATA !== 'undefined' && typeof USER_ANSWERS !== 'undefined') {
        Object.entries(USER_ANSWERS).forEach(([key, val]) => {
            if (val !== null && val !== undefined && QUIZ_DATA[key]) {
                userSelections[key] = QUIZ_DATA[key].answerOptions[val].text;
            }
        });
        updateProgress();
    }

    function updateProgress() {
        if (!QUIZ_DATA || QUIZ_DATA.length === 0 || !progressBar) return;

        const total = QUIZ_DATA.length;
        const answered = Object.keys(userSelections).length;
        const percentage = Math.round((answered / total) * 100);

        progressBar.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `${percentage}% Completed`;
        if (questionCounter) questionCounter.textContent = `${answered} / ${total}`;
    }

    function renderQuiz() {
        if (!QUIZ_DATA || QUIZ_DATA.length === 0 || !questionsContainer) return;

        questionsContainer.innerHTML = '';

        QUIZ_DATA.forEach((question, qIndex) => {
            const card = document.createElement('div');
            card.className = 'question-card card';
            card.style.animationDelay = `${qIndex * 0.1}s`;

            card.innerHTML += `<div class="question-title">${qIndex + 1}. ${question.question}</div>`;

            const optionGrid = document.createElement('div');
            optionGrid.className = 'option-grid';

            question.answerOptions.forEach((option, oIndex) => {
                const isSelected = userSelections[qIndex] === option.text;
                const pill = document.createElement('div');
                pill.className = 'option-pill';
                if (isSelected) pill.classList.add('active');

                const letter = String.fromCharCode(65 + oIndex); // A, B, C, D...

                // Review Mode Logic
                if (typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED) {
                    if (option.isCorrect) {
                        pill.classList.add('correct');
                        pill.innerHTML = `
                            <div class="option-indicator active">${letter}</div>
                            <span class="flex-grow-1">${option.text}</span>
                            <i class="fas fa-check-circle option-status-icon"></i>
                        `;
                    } else if (isSelected) {
                        pill.classList.add('incorrect');
                        pill.innerHTML = `
                            <div class="option-indicator active danger">${letter}</div>
                            <span class="flex-grow-1">${option.text}</span>
                            <i class="fas fa-times-circle option-status-icon"></i>
                        `;
                    } else {
                        pill.innerHTML = `
                            <div class="option-indicator">${letter}</div>
                            <span class="flex-grow-1">${option.text}</span>
                        `;
                    }
                } else {
                    // Active Selection Logic
                    pill.innerHTML = `
                        <div class="option-indicator">${letter}</div>
                        <span class="flex-grow-1">${option.text}</span>
                    `;
                    pill.addEventListener('click', function () {
                        const allPills = optionGrid.querySelectorAll('.option-pill');
                        allPills.forEach(p => p.classList.remove('active'));
                        this.classList.add('active');
                        userSelections[qIndex] = option.text;
                        updateProgress();
                    });
                }
                optionGrid.appendChild(pill);
            });

            card.appendChild(optionGrid);

            // Hint / Rationale Section
            const hintContainer = document.createElement('div');
            hintContainer.className = 'mt-4 pt-4 border-top';

            const hintBtn = document.createElement('button');
            hintBtn.type = 'button';
            hintBtn.className = 'btn btn-link p-0 text-decoration-none fw-bold text-primary';
            hintBtn.innerHTML = (typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED) ?
                '<i class="fas fa-comment-alt me-2"></i> View Expert Rationale' :
                '<i class="fas fa-lightbulb me-2"></i> Reveal a Hint';

            const hintBox = document.createElement('div');
            hintBox.className = 'hint-box d-none animate-fade-in';
            const correctOption = question.answerOptions.find(opt => opt.isCorrect);
            hintBox.innerHTML = `
                ${(typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED) ? `<p class="mb-2"><strong>Rationale:</strong> ${correctOption.rationale}</p>` : ''}
                <p class="mb-0"><strong>Hint:</strong> ${question.hint || 'Carefully analyze the context of the question.'}</p>
            `;

            hintBtn.addEventListener('click', () => {
                hintBox.classList.toggle('d-none');
            });

            hintContainer.appendChild(hintBtn);
            hintContainer.appendChild(hintBox);
            card.appendChild(hintContainer);

            questionsContainer.appendChild(card);
        });
    }

    // --- Submission ---
    if (quizForm) {
        quizForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED) return;

            const submitBtn = document.getElementById('submit-quiz-btn');
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50');
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing Results...';

            fetch('/submit_quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: userSelections })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) window.location.reload();
                    else {
                        submitBtn.disabled = false;
                        submitBtn.classList.remove('opacity-50');
                        submitBtn.innerHTML = 'Retry Submission';
                    }
                })
                .catch(() => {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-50');
                    submitBtn.innerHTML = 'Retry Submission';
                });
        });
    }

    // --- Results Summary Rendering ---
    function renderResultsSummary() {
        const resultsSummary = document.getElementById('results-summary');
        if (!resultsSummary || typeof IS_SUBMITTED === 'undefined' || !IS_SUBMITTED) return;

        const total = QUIZ_DATA.length;
        const score = SCORE;
        const percent = Math.round((score / total) * 100);

        let gradeColor = '#ef4444'; // Red
        let title = "Needs Focus";
        if (percent >= 80) { gradeColor = '#10b981'; title = "Mastery Achieved! 🏆"; }
        else if (percent >= 60) { gradeColor = '#f59e0b'; title = "Strong Progress"; }

        resultsSummary.innerHTML = `
            <div class="card border-0 shadow-lg text-white mb-5 overflow-hidden" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%)">
                <div class="row align-items-center">
                    <div class="col-md-5 p-5 text-center border-md-end border-white border-opacity-10">
                        <div class="display-1 fw-800" style="color: ${gradeColor}">${score}<span class="fs-2 opacity-50">/${total}</span></div>
                        <div class="h5 mt-2 fw-bold opacity-75">${percent}% Accurate</div>
                    </div>
                    <div class="col-md-7 p-5">
                        <h2 class="fw-bold mb-3">${title}</h2>
                        <p class="opacity-75 mb-4">Review the detailed assessment below. Focus on the expert rationales to bridge your knowledge gaps.</p>
                        <div class="progress bg-white bg-opacity-10" style="height: 12px; border-radius: 6px;">
                            <div class="progress-bar" style="width: ${percent}%; background: ${gradeColor}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    if (typeof QUIZ_DATA !== 'undefined' && QUIZ_DATA.length > 0) renderQuiz();
    if (typeof IS_SUBMITTED !== 'undefined' && IS_SUBMITTED) renderResultsSummary();
});