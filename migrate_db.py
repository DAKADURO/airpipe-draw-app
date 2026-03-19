import sqlite3
import os
from app import app
from extensions import db
from models import User, Project

def migrate():
    print("Iniciando migración desde projects.db (Crudo) -> app.db (SQLAlchemy ORM)...")
    db_path = os.path.join(os.path.dirname(__file__), 'projects.db')

    if not os.path.exists(db_path):
         print("No se encontró projects.db. No hay datos que migrar.")
         return

    with app.app_context():
        db.create_all()
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        
        users_migrated = 0
        projects_migrated = 0

        # Migrar Usuarios
        users = conn.execute("SELECT * FROM users").fetchall()
        for u in users:
            existing = User.query.filter_by(id=u['id']).first()
            if not existing:
                new_user = User(id=u['id'], email=u['email'], password_hash=u['password_hash'], created_at=u['created_at'])
                db.session.add(new_user)
                users_migrated += 1
        db.session.commit()
        
        # Migrar Proyectos
        try:
             projects_table_check = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").fetchone()
             if projects_table_check:
                 projects = conn.execute("SELECT * FROM projects").fetchall()
                 for p in projects:
                     existing = Project.query.filter_by(id=p['id']).first()
                     if not existing:
                         new_project = Project(
                             id=p['id'],
                             name=p['name'],
                             client=p['client'],
                             data=p['data'],
                             user_id=p['user_id'],
                             created_at=p['created_at'],
                             updated_at=p['updated_at']
                         )
                         db.session.add(new_project)
                         projects_migrated += 1
                 db.session.commit()
        except Exception as e:
             print(f"Error migrando proyectos: {e}")

        conn.close()
        print(f"Migración Completada. Usuarios: {users_migrated}, Proyectos: {projects_migrated}.")

if __name__ == '__main__':
    migrate()
