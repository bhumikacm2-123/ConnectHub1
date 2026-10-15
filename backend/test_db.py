
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

# Find .env in the same folder as this Python file.
backend_folder = Path(__file__).resolve().parent
env_file = backend_folder / ".env"

print("Checking .env file:", env_file)
print("File exists:", env_file.is_file())

load_dotenv(dotenv_path=env_file, override=True)

mongo_uri = os.getenv("MONGO_URI")

if not mongo_uri:
    raise RuntimeError(
        "MONGO_URI is missing. Check backend/.env "
        "and make sure the file contains MONGO_URI=..."
    )

client = MongoClient(
    mongo_uri,
    serverSelectionTimeoutMS=10000,
)

try:
    client.admin.command("ping")
    print("SUCCESS: Connected to MongoDB Atlas!")
    print("Database selected:", client["connecthub"].name)

except Exception as error:
    print("MongoDB connection failed.")
    print("Error type:", type(error).__name__)
    print("Error details:", str(error))

finally:
    client.close()
