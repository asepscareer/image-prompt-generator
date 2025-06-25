from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
import json
import os

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate-prompt', methods=['POST'])
def generate_prompt():
    try:
        data = request.get_json()
        details = data.get('details')
        text = f"""
            Based on the data below:

            {json.dumps(details, indent=4)}

            Please create a very detailed prompt. The sentences should not be stiff, and the delivery should be human-like (no need to adjust the JSON order).
            Emphasize every detail you deem important with "**" as a form of assertion. For example **with 8K UHD resolution** or **16:9 aspect ratio**.
            Always start with the phrase "Create an image".
            Emphasize the shot type / pose at the beginning of the sentence.
            Please use English.
        """

        if not details:
            return jsonify({'error': ' "details" data not found.'}), 400

        print(f"Request to Gemini API with payload: {text}")

        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={os.getenv('GEMINI_API_KEY')}"

        payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "details": text
                                })
                            }
                        ]
                    }
                ]
            }

        headers = {
                "Content-Type": "application/json"
            }

        response = requests.post(gemini_url, headers=headers, json=payload)
        response.raise_for_status()
        gemini_response = response.json()

        prompt_text = ""
        try:
            prompt_text = gemini_response['candidates'][0]['content']['parts'][0]['text']

        except Exception as e:
            return jsonify({'error': 'Gemini response format is not as expected.'}), 500

        return jsonify({'prompt': prompt_text}), 200

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Failed to connect to Gemini API: {str(e)}'}), 500
    except json.JSONDecodeError as e:
        return jsonify({'error': 'Invalid or non-JSON response from Gemini API.'}), 500
    except Exception as e:
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=os.getenv('PORT'))
