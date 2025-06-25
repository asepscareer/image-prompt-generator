// Ensure the DOM is fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    // Get references to various DOM elements
    const form = document.getElementById('promptForm');
    const generateButton = document.getElementById('generateButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultContainer = document.getElementById('resultContainer');
    const generatedPrompt = document.getElementById('generatedPrompt');
    const copyButton = document.getElementById('copyPromptBtn');
    const copyFeedback = document.getElementById('copySuccessMsg');
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    const importJsonInput = document.getElementById('importJsonInput');
    const clearFormBtn = document.getElementById('clearFormBtn'); // Get the clear form button

    // References for the modal dialog
    const modalContainer = document.createElement('div');
    modalContainer.id = 'customModal';
    modalContainer.className = 'fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center hidden z-50';
    modalContainer.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 id="modalTitle" class="text-xl font-semibold text-gray-800 mb-3"></h3>
            <p id="modalMessage" class="text-gray-700 mb-6"></p>
            <button id="modalCloseButton" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
                OK
            </button>
        </div>
    `;
    document.body.appendChild(modalContainer);

    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalCloseButton = document.getElementById('modalCloseButton');

    // Function to show the custom modal
    function showCustomModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalContainer.classList.remove('hidden');
    }

    // Function to hide the custom modal
    function hideCustomModal() {
        modalContainer.classList.add('hidden');
    }

    // Add event listener for the modal close button
    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', hideCustomModal);
    }

    // Sidebar navigation
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const sections = {
        generator: document.getElementById('section-generator'),
        sample: document.getElementById('section-sample')
    };

    // Initially show the generator section and highlight its sidebar link
    sections.generator.classList.remove('hidden');
    sidebarLinks[0].classList.add('bg-indigo-100');

    // Add event listeners for sidebar links to switch sections
    sidebarLinks.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all sidebar links
            sidebarLinks.forEach(b => b.classList.remove('bg-indigo-100'));
            // Add active class to the clicked link
            btn.classList.add('bg-indigo-100');
            // Hide all sections
            Object.values(sections).forEach(sec => sec.classList.add('hidden'));
            // Show the corresponding section
            sections[btn.dataset.section].classList.remove('hidden');
        });
    });

    // Fetch and display sample JSON
    let sampleJson = '';
    fetch('/static/sample.json')
        .then(response => response.ok ? response.text() : '')
        .then(text => {
            sampleJson = text;
            const sampleJsonCode = document.getElementById('sampleJsonCode');
            if (sampleJsonCode) {
                sampleJsonCode.textContent = sampleJson; // Display the raw JSON text
            }
        });

    // Copy sample JSON to clipboard logic
    const copySampleBtn = document.getElementById('copySampleJsonBtn');
    const copySampleMsg = document.getElementById('copySampleJsonMsg');
    if (copySampleBtn && copySampleMsg) {
        copySampleBtn.addEventListener('click', () => {
            // Use Clipboard API for modern browsers
            navigator.clipboard.writeText(sampleJson).then(() => {
                copySampleMsg.classList.remove('hidden');
                setTimeout(() => copySampleMsg.classList.add('hidden'), 1500);
            }).catch(err => {
                // Fallback for older browsers or if Clipboard API is not available/allowed
                const textarea = document.createElement('textarea');
                textarea.value = sampleJson;
                textarea.style.position = 'fixed';
                textarea.style.opacity = 0;
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                    document.execCommand('copy');
                    copySampleMsg.classList.remove('hidden');
                    setTimeout(() => copySampleMsg.classList.add('hidden'), 1500);
                } catch (e) {
                    showCustomModal('Copy Failed', 'Failed to copy text. Please copy manually.');
                } finally {
                    document.body.removeChild(textarea);
                }
            });
        });
    }

    // Function to collect form data into a structured object
    function collectFormData() {
        const resultData = {
            prompt: "", // This will be filled by the backend
            details: {}
        };

        // Select all input and textarea elements with a 'name' attribute
        const inputs = form.querySelectorAll('input[name], textarea[name]');
        inputs.forEach(input => {
            const name = input.name;
            const value = input.value.trim();

            // Skip empty values
            if (value === '') return;

            const parts = name.split('.'); // Split name by dot to handle nested objects
            let currentTarget = resultData;

            // Handle 'additional_notes' directly if it's a top-level field
            if (parts[0] === 'additional_notes') {
                if (!resultData.additional_notes) resultData.additional_notes = {};
                if (parts.length === 2) { // For "additional_notes.notes"
                    resultData.additional_notes[parts[1]] = value;
                }
                return;
            }

            // For all other fields, put them under 'details'
            currentTarget = resultData.details;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) { // If it's the last part of the name
                    // Special handling for comma-separated values
                    if (
                        (name === 'background.elements') || // Changed 'surrounding_objects' to 'background.elements' based on HTML form field
                        (name === 'action_and_interaction.actions')
                    ) {
                        currentTarget[part] = value.split(',').map(item => item.trim()).filter(item => item !== '');
                    } else {
                        currentTarget[part] = value;
                    }
                } else { // If it's an intermediate part (creating nested objects)
                    if (!currentTarget[part] || typeof currentTarget[part] !== 'object') {
                        currentTarget[part] = {};
                    }
                    currentTarget = currentTarget[part];
                }
            }
        });

        // Recursively remove empty objects/arrays/undefined values
        function removeEmpty(obj) {
            if (Array.isArray(obj)) {
                const filtered = obj.map(removeEmpty).filter(item => item !== undefined);
                return filtered.length > 0 ? filtered : undefined;
            } else if (typeof obj === 'object' && obj !== null) {
                const newObj = {};
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        const value = removeEmpty(obj[key]);
                        if (value !== undefined) {
                            newObj[key] = value;
                        }
                    }
                }
                return Object.keys(newObj).length > 0 ? newObj : undefined;
            } else {
                return (obj === '' || obj === null) ? undefined : obj;
            }
        }

        // Apply removal of empty structures
        if (resultData.details) resultData.details = removeEmpty(resultData.details) || {};
        if (resultData.additional_notes) resultData.additional_notes = removeEmpty(resultData.additional_notes);

        return resultData;
    }

    // Function to copy text to clipboard with fallback
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                if (copyFeedback) {
                    copyFeedback.classList.remove('hidden');
                    setTimeout(() => copyFeedback.classList.add('hidden'), 1500);
                }
            }).catch(() => {
                showCustomModal('Copy Failed', 'Failed to copy text. Please try again or copy manually.');
            });
        } else {
            // Fallback for browsers that do not support navigator.clipboard
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = 0;
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                document.execCommand('copy');
                if (copyFeedback) {
                    copyFeedback.classList.remove('hidden');
                    setTimeout(() => copyFeedback.classList.add('hidden'), 1500);
                }
            } catch (err) {
                showCustomModal('Copy Failed', 'Failed to copy text. Please copy manually.');
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }

    // Function to populate form fields from a JSON object
    function applyJsonToForm(jsonData, parentKey = '') {
        const inputs = form.querySelectorAll('input[name], textarea[name]');
        const unmatchedKeys = [];

        for (const key in jsonData) {
            if (Object.prototype.hasOwnProperty.call(jsonData, key)) {
                const value = jsonData[key];
                const fullKey = parentKey ? `${parentKey}.${key}` : key;

                if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                    // Recursively handle nested objects
                    unmatchedKeys.push(...applyJsonToForm(value, fullKey));
                } else {
                    // Find the corresponding input field
                    const input = Array.from(inputs).find(input => input.name === fullKey || input.id === fullKey);
                    if (input) {
                        // Set input value, handling arrays by joining them with ', '
                        input.value = Array.isArray(value) ? value.join(', ') : value;
                    } else {
                        // Keep track of keys that don't match any form field
                        unmatchedKeys.push(fullKey);
                    }
                }
            }
        }
        return unmatchedKeys;
    }

    // Event listener for importing JSON file
    importJsonInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                // Try to populate 'details' and 'additional_notes' from the JSON
                const detailsUnmatched = applyJsonToForm(jsonData.details || {});
                const notesUnmatched = applyJsonToForm(jsonData.additional_notes || {}, 'additional_notes'); // Pass parent key for notes

                const allUnmatched = [...detailsUnmatched, ...notesUnmatched];

                if (allUnmatched.length > 0) {
                    showCustomModal('Import Warning', `Some fields do not match the JSON: ${allUnmatched.join(', ')}. Remaining fields were filled.`);
                } else {
                    showCustomModal('Import Success', 'JSON imported successfully and all fields filled.');
                }
            } catch (error) {
                showCustomModal('Invalid JSON', 'Invalid JSON file. Please ensure the format is correct.');
            }
        };
        reader.readAsText(file);
    });

    // Clear form logic
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', function () {
            if (!form) return;
            // Reset all input, textarea, and select elements
            form.querySelectorAll('input, textarea, select').forEach(el => {
                if (el.type === 'file') return; // Skip file inputs
                if (el.type === 'checkbox' || el.type === 'radio') {
                    el.checked = false; // Uncheck checkboxes/radios
                } else {
                    el.value = ''; // Clear text inputs/textareas
                }
            });
            // Also hide result and error containers when clearing the form
            resultContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
            generatedPrompt.textContent = '';
            errorMessage.textContent = '';
            if (copyButton) {
                copyButton.classList.add('hidden');
            }
            if (copyFeedback) {
                copyFeedback.classList.add('hidden');
            }
        });
    }


    // Handle form submission to generate prompt
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        // Hide previous results and errors
        resultContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');
        generatedPrompt.textContent = '';
        errorMessage.textContent = '';

        // Show loading indicator and disable button
        loadingIndicator.classList.remove('hidden');
        generateButton.disabled = true;
        generateButton.classList.add('opacity-50', 'cursor-not-allowed');
        if (copyButton) {
            copyButton.classList.add('hidden'); // Hide copy button during generation
        }
        if (copyFeedback) {
            copyFeedback.classList.add('hidden'); // Hide copy feedback
        }

        const formData = collectFormData(); // Collect data from the form
        console.log('Sending data to backend:', formData);

        try {
            // Send data to the Flask backend
            const response = await fetch('/generate-prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json(); // Parse the JSON response
            console.log('Response from backend result (full object):', result);

            if (response.ok) {
                console.log('Response from backend OK.');
                // Display the generated prompt
                if (typeof result.prompt === 'object' && result.prompt !== null) {
                    generatedPrompt.textContent = JSON.stringify(result.prompt, null, 2);
                } else {
                    generatedPrompt.textContent = String(result.prompt || '');
                }

                resultContainer.classList.remove('hidden'); // Show the result container
                if (copyButton) {
                    copyButton.classList.remove('hidden'); // Show copy button
                }
            } else {
                // Display error message
                errorMessage.textContent = result.error || 'An unknown error occurred.';
                errorContainer.classList.remove('hidden'); // Show the error container
                console.error('Error from backend:', result.error);
            }
        } catch (error) {
            // Handle network or other unexpected errors
            errorMessage.textContent = `Failed to connect to server or an error occurred: ${error.message}`;
            errorContainer.classList.remove('hidden');
            console.error('Error during fetch:', error);
        } finally {
            // Always hide loading indicator and re-enable button
            loadingIndicator.classList.add('hidden');
            generateButton.disabled = false;
            generateButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });

    // Add event listener for the copy prompt button
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            copyToClipboard(generatedPrompt.textContent);
        });
    }

    const saveJsonBtn = document.getElementById('saveJsonBtn');
    if (saveJsonBtn) {
        saveJsonBtn.addEventListener('click', function () {
            const data = collectFormData();
            if ('prompt' in data) delete data.prompt;
            const jsonStr = JSON.stringify(data, null, 4);
            console.log(jsonStr)
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'prompt-data.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
});
