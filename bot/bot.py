import os
from dotenv import load_dotenv
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters
from database import Session, Message
import logging
from telegram import Update
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Load environment variables
load_dotenv()
token = os.getenv('TELEGRAM_TOKEN')  # your token here

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Path to the fine-tuned model directory
fine_tuned_model_path = "../models/fine_tuned_model"

# Load the tokenizer and model
tokenizer = AutoTokenizer.from_pretrained(fine_tuned_model_path)
model = AutoModelForSeq2SeqLM.from_pretrained(fine_tuned_model_path)


async def start(update: Update, context):
    """Handle the /start command."""
    await update.message.reply_text("Hi. Send me a text and I'll process it.")


async def handle_message(update: Update, context):
    """Handle incoming messages and perform grammar correction."""
    user = update.message.from_user
    user_id = user.id
    username = user.username if user.username else user.first_name
    user_text = update.message.text

    try:
        # Tokenize the input text
        inputs = tokenizer(user_text, return_tensors="pt",
                           padding=True, truncation=True)

        # Generate corrected output
        outputs = model.generate(**inputs)
        corrected_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Save the message to the database
        session = Session()
        message = Message(
            user_id=user_id,
            username=username,
            message_text=user_text,
        )
        session.add(message)
        session.commit()
        session.close()

        # Reply with the original and corrected text
        await update.message.reply_text(f"*Original:*\n{user_text}", parse_mode='Markdown')
        await update.message.reply_text(f"*Corrected:*\n{corrected_text}", parse_mode='Markdown')

    except Exception as e:
        logging.error(f"Error when processing the message: {e}")
        await update.message.reply_text("There was an error processing your message.")
    finally:
        if 'session' in locals() and session:
            session.close()


def main():
    """Start the Telegram bot."""
    app = ApplicationBuilder().token(token).build()
    app.add_handler(CommandHandler('start', start))
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling()


if __name__ == '__main__':
    main()
