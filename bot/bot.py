from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters
from database import Session, Message
import logging
from telegram import Update
token = ''  # your token


logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)


async def start(update: Update, context):
    await update.message.reply_text("Привет! Отправь мне текст, и я его обработаю.")


async def handle_message(update: Update, context):
    user = update.message.from_user
    user_id = user.id
    username = user.username if user.username else user.first_name
    user_text = update.message.text

    try:

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
        logging.error(f"Ошибка при сохранении сообщения: {e}")
        await update.message.reply_text("Произошла ошибка при сохранении сообщения.")
    finally:
        if session:
            session.close()
    await update.message.reply_text(f"Ты отправил: {user_text}")


def main():
    app = ApplicationBuilder().token(
        '7296138961:AAF9Ns7hCmSPRDQgqQezufcP0xSZpXQLaeg').build()

    app.add_handler(CommandHandler('start', start))
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling()


if __name__ == '__main__':
    main()
