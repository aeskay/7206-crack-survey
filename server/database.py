import os
import sys
import glob
import json
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "crack-survey-manager-fs")
server_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(server_dir)

def find_service_account_path():
    # 1. Explicit env var
    env_cred = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if env_cred:
        # Check relative to server_dir or absolute
        if os.path.exists(env_cred):
            return env_cred
        cand = os.path.join(server_dir, env_cred)
        if os.path.exists(cand):
            return cand

    # 2. Standard filename in server directory
    standard_server = os.path.join(server_dir, "serviceAccountKey.json")
    if os.path.exists(standard_server):
        return standard_server

    # 3. Standard filename in root directory
    standard_root = os.path.join(root_dir, "serviceAccountKey.json")
    if os.path.exists(standard_root):
        return standard_root

    # 4. Any downloaded firebase-adminsdk json file in server or root
    candidates = glob.glob(os.path.join(server_dir, "*firebase-adminsdk*.json")) + \
                 glob.glob(os.path.join(root_dir, "*firebase-adminsdk*.json"))
    if candidates:
        return candidates[0]

    return None

def init_firestore():
    if not firebase_admin._apps:
        cred_path = find_service_account_path()
        if cred_path:
            print(f"[Firebase] Initializing with service account: {cred_path}")
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {
                'projectId': PROJECT_ID
            })
        else:
            # Check if JSON string was supplied directly via env var (e.g. on Render)
            json_str = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
            if json_str:
                try:
                    cred_dict = json.loads(json_str)
                    cred = credentials.Certificate(cred_dict)
                    firebase_admin.initialize_app(cred, {'projectId': PROJECT_ID})
                    print("[Firebase] Initialized with inline JSON credentials.")
                except Exception as e:
                    print(f"[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")
                    raise
            else:
                raise FileNotFoundError(
                    "\n========================================================================\n"
                    "[Firebase Service Account Key Required]\n"
                    "Could not find Firebase service account credentials.\n\n"
                    "How to get it:\n"
                    "1. Go to Firebase Console -> Project Settings (gear icon) -> Service accounts tab\n"
                    "   (Direct URL: https://console.firebase.google.com/project/crack-survey-manager-fs/settings/serviceaccounts/adminsdk)\n"
                    "2. Click 'Generate new private key' -> 'Generate key'\n"
                    f"3. Save the downloaded JSON file as: {os.path.join(server_dir, 'serviceAccountKey.json')}\n"
                    "   (Or paste the file contents in the chat and I'll place it for you!)\n"
                    "========================================================================\n"
                )

    return firestore.client()

try:
    db = init_firestore()
except FileNotFoundError as err:
    print(err)
    db = None
