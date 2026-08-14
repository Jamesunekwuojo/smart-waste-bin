import os
import logging
from logging.config import dictConfig
from flask import Flask
from backend.config import config_by_name
from backend.extensions import db, cors

def setup_logging():
    """Sets up structured WSGI and rotating file logging."""
    dictConfig({
        'version': 1,
        'formatters': {
            'default': {
                'format': '[%(asctime)s] %(levelname)s in %(module)s (%(filename)s:%(lineno)d): %(message)s',
            }
        },
        'handlers': {
            'wsgi': {
                'class': 'logging.StreamHandler',
                'stream': 'ext://flask.logging.wsgi_errors_stream',
                'formatter': 'default'
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'filename': 'backend.log',
                'maxBytes': 1024 * 1024 * 5,  # 5 MB
                'backupCount': 5,
                'formatter': 'default'
            }
        },
        'root': {
            'level': 'INFO',
            'handlers': ['wsgi', 'file']
        }
    })

def create_app(config_name=None):
    setup_logging()
    
    app = Flask(__name__, static_folder="static")
    
    # Resolve config environment
    if not config_name:
        config_name = os.environ.get("FLASK_ENV", "development")
        
    config_obj = config_by_name.get(config_name, config_by_name["default"])
    app.config.from_object(config_obj)
    
    # Initialize SQLAlchemy & CORS
    db.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ALLOWED_ORIGINS"]}})
    
    # Ensure static and subdirectories exist
    os.makedirs(app.config["STATIC_FOLDER"], exist_ok=True)
    os.makedirs(os.path.join(app.config["STATIC_FOLDER"], "gradcam"), exist_ok=True)
    
    # Ensure database directory exists for SQLite
    db_uri = app.config["SQLALCHEMY_DATABASE_URI"]
    if db_uri.startswith("sqlite:///"):
        db_path = db_uri.replace("sqlite:///", "")
        if db_path != ":memory:":
            db_dir = os.path.dirname(db_path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)
                
    # Register api blueprints
    from backend.api import api_bp
    app.register_blueprint(api_bp, url_prefix="/api")
    
    @app.route("/health")
    def health_check():
        return {"status": "healthy", "config": config_name}, 200

    # Create tables automatically inside app context
    with app.app_context():
        db.create_all()
        
    app.logger.info(f"EcoBin IoT waste management backend initialized [{config_name}]")
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000)
