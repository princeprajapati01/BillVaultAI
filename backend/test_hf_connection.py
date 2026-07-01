import sys
import os
from dotenv import load_dotenv

# Load backend/.env configurations
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, ".env")
load_dotenv(env_path)

HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "").strip()
HUGGINGFACE_MODEL = os.getenv("HUGGINGFACE_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct").strip()

def test_connection():
    print("==================================================")
    print("Testing Hugging Face Inference API Connection")
    print("==================================================")
    print(f"Model configured: {HUGGINGFACE_MODEL}")
    
    if not HUGGINGFACE_API_KEY:
        print("[ERROR] HUGGINGFACE_API_KEY is not set in backend/.env!")
        print("Please add the following lines to your backend/.env file:")
        print("HUGGINGFACE_API_KEY=your_huggingface_api_token_here")
        print("HUGGINGFACE_MODEL=Qwen/Qwen2.5-VL-72B-Instruct")
        return

    print("HUGGINGFACE_API_KEY is set. Masked key: " + HUGGINGFACE_API_KEY[:4] + "..." + HUGGINGFACE_API_KEY[-4:])
    print("Connecting to Hugging Face...")
    
    try:
        from huggingface_hub import InferenceClient
        client = InferenceClient(token=HUGGINGFACE_API_KEY)
        
        print("Sending test chat completion request...")
        response = client.chat.completions.create(
            model=HUGGINGFACE_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Respond with exactly: 'Hugging Face and Qwen are working perfectly!'"}
            ],
            max_tokens=50
        )
        
        response_text = response.choices[0].message.content.strip()
        print("\n[SUCCESS] Response from Qwen model:")
        print("-" * 40)
        print(response_text)
        print("-" * 40)
        print("Your Hugging Face integration is fully functional and ready!")
        
    except Exception as e:
        print("\n[ERROR] Connection failed!")
        print(f"Error Details: {e}")
        print("\nTroubleshooting tips:")
        print("1. Double check that your HUGGINGFACE_API_KEY is correct and active.")
        print("2. Ensure the model name exists and is spelt correctly.")
        print("3. Check if the Hugging Face serverless endpoint for this model is currently active/loaded.")

if __name__ == "__main__":
    test_connection()
