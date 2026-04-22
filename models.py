import datetime
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator, Text
from extensions import db
import json


class JSONBWithFallback(TypeDecorator):
    """
    Uses JSONB natively on PostgreSQL, falls back to Text + JSON serialization on SQLite.
    This allows local development with SQLite while production uses PostgreSQL JSONB.
    """
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(JSONB)
        return dialect.type_descriptor(Text)

    def process_bind_param(self, value, dialect):
        if value is not None and dialect.name != 'postgresql':
            return json.dumps(value, ensure_ascii=False)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and dialect.name != 'postgresql' and isinstance(value, str):
            return json.loads(value)
        return value


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationship to projects
    projects = db.relationship('Project', backref='owner', lazy=True, cascade="all, delete-orphan")


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(120), nullable=False)
    client = db.Column(db.String(120), default='')
    data = db.Column(JSONBWithFallback, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
