import datetime
from extensions import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.String(50), default=lambda: datetime.datetime.now().isoformat(), nullable=False)

    # Relationship to projects
    projects = db.relationship('Project', backref='owner', lazy=True, cascade="all, delete-orphan")

class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(120), nullable=False)
    client = db.Column(db.String(120), default='')
    data = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.String(50), default=lambda: datetime.datetime.now().isoformat(), nullable=False)
    updated_at = db.Column(db.String(50), default=lambda: datetime.datetime.now().isoformat(), onupdate=lambda: datetime.datetime.now().isoformat(), nullable=False)
