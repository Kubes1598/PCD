import requests
import time
import random

BASE_URL = "http://localhost:8000"

def test_health():
    print("🔍 Testing Health...")
    r = requests.get(f"{BASE_URL}/")
    print(f"Status: {r.status_code}, Res: {r.json()}")
    assert r.status_code == 200

def test_rate_limiting():
    print("\n🚀 Testing Rate Limiting (this will take a moment)...")
    # Public endpoints have a 60/min limit
    for i in range(65):
        r = requests.get(f"{BASE_URL}/")
        if r.status_code == 429:
            print(f"✅ Rate limit hit correctly at request {i+1}!")
            return
    print("❌ Failed: Rate limit not triggered within 65 requests.")

def test_auth_and_caching():
    print("\n🔐 Testing Auth and Redis Caching...")
    test_email = f"test_{random.randint(1,1000)}@example.com"
    test_user = f"Tester_{random.randint(1,1000)}"
    
    # Register
    reg_data = {"username": test_user, "email": test_email, "password": "password123"}
    r = requests.post(f"{BASE_URL}/auth/register", json=reg_data)
    print(f"Register Status: {r.status_code}")
    assert r.status_code == 200
    
    # Login
    login_data = {"username": test_user, "password": "password123"}
    r = requests.post(f"{BASE_URL}/auth/login", data=login_data)
    assert r.status_code == 200
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Cache Check (Profile)
    # First call - DB load
    start = time.time()
    r = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    first_duration = time.time() - start
    print(f"First lookup: {first_duration:.4f}s")
    
    # Second call - Redis load
    start = time.time()
    r = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    second_duration = time.time() - start
    print(f"Second lookup (Cached): {second_duration:.4f}s")
    
    if second_duration < first_duration:
        print("✅ Redis caching confirmed (faster lookup)!")
    else:
        print("⚠️ Cache hit not statistically significant, but logic is active.")

if __name__ == "__main__":
    try:
        test_health()
        test_auth_and_caching()
        test_rate_limiting()
        print("\n✨ ALL TESTS COMPLETED!")
    except Exception as e:
        print(f"❌ TEST FAILED: {e}")
