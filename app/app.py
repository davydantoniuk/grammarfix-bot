import os
from flask import Flask, request, jsonify, render_template
from happytransformer import HappyTextToText, TTSettings

model_path = os.path.join(os.path.dirname(
    os.path.abspath(__file__)), os.pardir, "t5-base-grammar-correction/")
happy_tt = HappyTextToText("T5", model_path)
# happy_tt = HappyTextToText("T5", "vennify/t5-base-grammar-correction")
args = TTSettings(num_beams=5, min_length=1)

app = Flask(__name__)


@app.route('/')
def home():
    return render_template("index.html")


@app.route('/correct', methods=['POST'])
def correct_sentence():
    data = request.json
    if "sentence" not in data:
        return jsonify({"error": "Please provide a sentence to correct"}), 400

    input_sentence = data["sentence"]
    corrected_sentence = happy_tt.generate_text(
        f"grammar: {input_sentence}", args=args)
    return jsonify({"corrected_sentence": corrected_sentence.text})


if __name__ == '__main__':
    app.run(debug=True)

# http://127.0.0.1:5000/
