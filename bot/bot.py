import os
from dotenv import load_dotenv
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters
from database import Session, Message
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from happytransformer import HappyTextToText, TTSettings
import tf_keras

load_dotenv()
token = os.getenv('TELEGRAM_TOKEN')  # your token here

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Initialize the HappyTextToText model from the local directory
model_path = os.path.join(os.path.dirname(
    os.path.abspath(__file__)), os.pardir, "t5-base-grammar-correction/")
happy_tt = HappyTextToText("T5", model_path)
# happy_tt = HappyTextToText("T5", "vennify/t5-base-grammar-correction")
args = TTSettings(num_beams=5, min_length=1)


async def start(update: Update, context):
    await update.message.reply_text("Hi. Send me a text and I'll process it.")


async def handle_message(update: Update, context):
    user = update.message.from_user
    user_id = user.id
    username = user.username if user.username else user.first_name
    user_text = update.message.text

    try:
        # Correct the user's input text using the local model
        corrected_text = happy_tt.generate_text(
            f"grammar: {user_text}", args=args).text

        session = Session()
        message = Message(
            user_id=user_id,
            username=username,
            message_text=user_text,
        )
        session.add(message)
        session.commit()
        session.close()
    except Exception as e:
        logging.error(f"Error when saving a message: {e}")
        await update.message.reply_text("There was an error when saving the message.")
    finally:
        if session:
            session.close()
    await update.message.reply_text(f"*Original:*\n{user_text}", parse_mode='Markdown')
    await update.message.reply_text(f"*Corrected:*\n{corrected_text}", parse_mode='Markdown')


def main():
    app = ApplicationBuilder().token(token).build()
    app.add_handler(CommandHandler('start', start))
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling()


if __name__ == '__main__':
    main()
