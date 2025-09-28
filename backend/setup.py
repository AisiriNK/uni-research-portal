"""
Setup script for Research Hub Backend
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"   Error: {e.stderr}")
        return False

def setup_backend():
    """Setup the backend environment"""
    print("🚀 Setting up Research Hub Backend\n")
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
        print("❌ Python 3.8+ is required")
        return False
    
    print(f"✅ Python {python_version.major}.{python_version.minor}.{python_version.micro} detected")
    
    # Create virtual environment
    if not os.path.exists("venv"):
        if not run_command("python -m venv venv", "Creating virtual environment"):
            return False
    else:
        print("✅ Virtual environment already exists")
    
    # Activate virtual environment and install dependencies
    if os.name == 'nt':  # Windows
        activate_cmd = "venv\\Scripts\\activate && pip install -r requirements.txt"
    else:  # Linux/Mac
        activate_cmd = "source venv/bin/activate && pip install -r requirements.txt"
    
    if not run_command(activate_cmd, "Installing dependencies"):
        return False
    
    # Create .env file if it doesn't exist
    if not os.path.exists(".env"):
        print("🔧 Creating .env file...")
        try:
            with open(".env.example", "r") as example_file:
                content = example_file.read()
            
            with open(".env", "w") as env_file:
                env_file.write(content)
            
            print("✅ .env file created from template")
            print("⚠️  Please edit .env file and add your GROQ_API_KEY")
        except Exception as e:
            print(f"❌ Error creating .env file: {e}")
    else:
        print("✅ .env file already exists")
    
    print("\n🎉 Backend setup completed!")
    print("\nNext steps:")
    print("1. Edit .env file and add your GROQ_API_KEY")
    print("2. Activate virtual environment:")
    if os.name == 'nt':
        print("   venv\\Scripts\\activate")
    else:
        print("   source venv/bin/activate")
    print("3. Start the server:")
    print("   python app.py")
    print("4. Test the API:")
    print("   python test_api.py")
    
    return True

if __name__ == "__main__":
    setup_backend()
