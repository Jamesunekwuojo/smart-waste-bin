import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-12345")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # SQLite Database URI
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(BASE_DIR, 'db', 'waste_management.db')}"
    )
    
    # CORS Origins (comma separated list in env)
    CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    
    # Path to the LSTM model file
    MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(BASE_DIR, "inference", "lstm_model.onnx"))
    
    # Threshold for generating collection alerts (percent)
    ALERT_FILL_THRESHOLD = float(os.environ.get("ALERT_FILL_THRESHOLD", "95.0"))
    
    # Static folder location for gradcam images
    STATIC_FOLDER = os.path.join(BASE_DIR, "static")

class DevelopmentConfig(Config):
    DEBUG = True

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

class ProductionConfig(Config):
    DEBUG = False
    # Ensure SECRET_KEY is set in prod environment
    SECRET_KEY = os.environ.get("SECRET_KEY", "secure-prod-key-change-me")

config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig
}
