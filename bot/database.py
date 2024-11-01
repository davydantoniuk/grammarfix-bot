import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base
import datetime


os.makedirs("bot", exist_ok=True)
engine = create_engine('sqlite:///bot/bot_messages.db')

Base = declarative_base()


class Message(Base):
    __tablename__ = 'messages'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    username = Column(String(50), nullable=True)
    message_text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


Base.metadata.create_all(engine)


Session = sessionmaker(bind=engine)
