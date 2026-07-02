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

def deploy_stack():
    compose_content = get_compose_content()
    
    payload = {
        "Name": "docsign",
        "StackFileContent": compose_content,
        "Env": []
    }
    
    # Standalone stack creation from compose string
    url = f"{base}/api/stacks/create/standalone/string?endpointId={endpoint_id}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "x-api-key": token,
            "Content-Type": "application/json"
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, context=ssl_context) as r:
            print("Portainer Stack Created and Deployed Successfully!")
            print(r.read().decode())
    except urllib.error.HTTPError as e:
        print("Deployment Failed:", e.code)
        print(e.read().decode(errors="replace"))
        sys.exit(1)

if __name__ == "__main__":
    deploy_stack()
