import os
from flask import Flask, request, jsonify, render_template
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Path to the fine-tuned model directory
fine_tuned_model_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    os.pardir,
    "models/fine_tuned_model"
)

# Load the tokenizer and model
tokenizer = AutoTokenizer.from_pretrained(fine_tuned_model_path)
model = AutoModelForSeq2SeqLM.from_pretrained(fine_tuned_model_path)

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

    # Tokenize the input
    inputs = tokenizer(input_sentence, return_tensors="pt",
                       padding=True, truncation=True)

    # Generate output using the model
    outputs = model.generate(**inputs)

    # Decode the output to get the corrected sentence
    corrected_sentence = tokenizer.decode(outputs[0], skip_special_tokens=True)

    return jsonify({"corrected_sentence": corrected_sentence})


if __name__ == '__main__':
    app.run(debug=True)
