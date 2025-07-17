#!/usr/bin/env python3
"""
Simple runner script for AI Story Writer
"""
import subprocess
import sys
import time
import webbrowser
from pathlib import Path


def run_backend():
    """Start the backend server"""
    backend_dir = Path(__file__).parent / "backend"
    try:
        print("🚀 Starting AI Story Writer backend...")
        # Ensure dependencies are installed
        print("📦 Installing backend dependencies...")
        subprocess.run(
            ["uv", "pip", "install", "-r", "requirements.txt"],
            cwd=backend_dir,
            check=False,
        )
        return subprocess.Popen(
            ["uv", "run", "python", "main.py"],
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError:
        print("❌ Error: 'uv' not found. Please install uv package manager.")
        print("Visit: https://docs.astral.sh/uv/getting-started/installation/")
        return None


def run_frontend():
    """Serve the frontend via Python's built-in server"""
    frontend_dir = Path(__file__).parent / "frontend"
    try:
        print("🎨 Starting AI Story Writer frontend...")
        print("📦 Static files ready - using Python server")
        return subprocess.Popen(
            ["python", "-m", "http.server", "5173"],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except Exception as e:
        print(f"❌ Error: Failed to start frontend server: {e}")
        return None


def check_ollama():
    """Check if Ollama is running"""
    try:
        result = subprocess.run(
            ["curl", "-s", "http://localhost:11434/api/tags"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except:
        return False


def main():
    print("🤖 AI Story Writer - Starting Application")
    print("=" * 50)

    # Check prerequisites
    if not check_ollama():
        print("⚠️  Warning: Ollama doesn't seem to be running on localhost:11434")
        print("   Please make sure Ollama is installed and running.")
        print("   Visit: https://ollama.ai")
        print()

    # Start backend
    backend_process = run_backend()
    if not backend_process:
        sys.exit(1)

    # Wait a moment for backend to start
    time.sleep(2)

    # Start frontend
    frontend_process = run_frontend()
    if not frontend_process:
        backend_process.terminate()
        sys.exit(1)

    # Wait a moment for frontend to start
    time.sleep(3)

    print("✅ Application started successfully!")
    print("🌐 Frontend (Main UI): http://localhost:5173")
    print("🔧 Backend API: http://localhost:8000/api/v1")
    print("📚 API Docs: http://localhost:8000/docs")
    print("💡 Health Check: http://localhost:8000/api/v1/health")
    print()
    print("👉 Open http://localhost:5173 to use the AI Story Writer!")
    print("Press Ctrl+C to stop both servers...")

    # Optional: Open browser
    try:
        webbrowser.open("http://localhost:5173")
    except:
        pass

    try:
        # Wait for processes
        backend_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\n🛑 Stopping servers...")
        backend_process.terminate()
        frontend_process.terminate()
        print("✅ Servers stopped.")


if __name__ == "__main__":
    main()
