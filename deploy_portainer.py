import urllib.request
import json
import ssl
import sys

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

base = "https://docker.server.mtcd.org"
token = "ptr_caKh16OVXC+3G4shu9s7TXtumDZY04R6wwaOYkq+Pls="
endpoint_id = 2 # Church Synology endpoint

def get_compose_content():
    with open("docker-compose.portainer.yml", "r") as f:
        return f.read()

def get_existing_stack_id():
    url = f"{base}/api/stacks"
    req = urllib.request.Request(
        url,
        headers={
            "x-api-key": token,
            "Accept": "application/json"
        },
        method="GET"
    )
    try:
        with urllib.request.urlopen(req, context=ssl_context) as r:
            stacks = json.loads(r.read().decode())
            for s in stacks:
                if s.get("Name") == "docsign":
                    return s.get("Id")
    except Exception as e:
        print("Failed to check existing stacks:", e)
    return None

def deploy_stack():
    compose_content = get_compose_content()
    
    stack_id = get_existing_stack_id()
    if stack_id:
        print(f"Stack 'docsign' already exists (ID: {stack_id}). Updating stack...")
        payload = {
            "StackFileContent": compose_content,
            "Env": [],
            "Prune": True,
            "PullImage": True
        }
        url = f"{base}/api/stacks/{stack_id}?endpointId={endpoint_id}"
        method = "PUT"
    else:
        print("Stack 'docsign' does not exist. Creating stack...")
        payload = {
            "Name": "docsign",
            "StackFileContent": compose_content,
            "Env": []
        }
        url = f"{base}/api/stacks/create/standalone/string?endpointId={endpoint_id}"
        method = "POST"
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "x-api-key": token,
            "Content-Type": "application/json"
        },
        method=method
    )
    
    try:
        with urllib.request.urlopen(req, context=ssl_context) as r:
            action = "Updated" if method == "PUT" else "Created and Deployed"
            print(f"Portainer Stack {action} Successfully!")
            print(r.read().decode())
    except urllib.error.HTTPError as e:
        print("Deployment Failed:", e.code)
        print(e.read().decode(errors="replace"))
        sys.exit(1)

if __name__ == "__main__":
    deploy_stack()
