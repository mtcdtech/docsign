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
    import os
    with open("docker-compose.portainer.yml", "r") as f:
        content = f.read()
    image_sha = os.environ.get("IMAGE_SHA")
    if image_sha:
        # If it starts with sha256:, use it, otherwise format it
        digest = image_sha if image_sha.startswith("sha256:") else f"sha256:{image_sha}"
        content = content.replace("mtcdtech/docsign:latest", f"mtcdtech/docsign@{digest}")
        print(f"Using compose image digest: mtcdtech/docsign@{digest}")
    return content

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

def get_existing_stack_env(stack_id):
    url = f"{base}/api/stacks/{stack_id}"
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
            stack = json.loads(r.read().decode())
            return stack.get("Env", [])
    except Exception as e:
        print("Failed to fetch existing stack env:", e)
    return []

def load_local_env():
    env_vars = {}
    try:
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                parts = line.split("=", 1)
                key = parts[0].strip()
                val = parts[1].strip()
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                env_vars[key] = val
    except Exception as e:
        print("Warning: Could not read local .env file:", e)
    return env_vars

EXCLUDE_SYNC_KEYS = {
    "DATABASE_URL",
    "NEXTAUTH_URL",
    "AUTHENTIK_CLIENT_ID",
    "AUTHENTIK_CLIENT_SECRET",
    "AUTHENTIK_ISSUER"
}

def deploy_stack():
    compose_content = get_compose_content()
    local_env = load_local_env()
    
    stack_id = get_existing_stack_id()
    if stack_id:
        print(f"Stack 'docsign' already exists (ID: {stack_id}). Updating stack...")
        existing_env = get_existing_stack_env(stack_id)
        
        merged_env_dict = {item["name"]: item["value"] for item in existing_env}
        for k, v in local_env.items():
            if v and k not in EXCLUDE_SYNC_KEYS:
                merged_env_dict[k] = v
                
        # Enforce strict production overrides for critical database and auth config
        merged_env_dict["DATABASE_URL"] = "file:/app/data/dev.db"
        merged_env_dict["NEXTAUTH_URL"] = "https://docsign.server.mtcd.org"
        merged_env_dict["AUTHENTIK_CLIENT_ID"] = "docsign_client_id_mtcd"
        merged_env_dict["AUTHENTIK_CLIENT_SECRET"] = "GMym0HOG89dShkeZVvGwheeEkvUmcLwiIYjemwZZonCyCYiF"
        merged_env_dict["AUTHENTIK_ISSUER"] = "https://auth.server.mtcd.org/application/o/docsign"
                
        final_env = [{"name": k, "value": v} for k, v in merged_env_dict.items()]
        
        payload = {
            "StackFileContent": compose_content,
            "Env": final_env,
            "Prune": True,
            "PullImage": True
        }
        url = f"{base}/api/stacks/{stack_id}?endpointId={endpoint_id}"
        method = "PUT"
    else:
        print("Stack 'docsign' does not exist. Creating stack...")
        temp_env = {k: v for k, v in local_env.items() if v and k not in EXCLUDE_SYNC_KEYS}
        temp_env["DATABASE_URL"] = "file:/app/data/dev.db"
        temp_env["NEXTAUTH_URL"] = "https://docsign.server.mtcd.org"
        temp_env["AUTHENTIK_CLIENT_ID"] = "docsign_client_id_mtcd"
        temp_env["AUTHENTIK_CLIENT_SECRET"] = "GMym0HOG89dShkeZVvGwheeEkvUmcLwiIYjemwZZonCyCYiF"
        temp_env["AUTHENTIK_ISSUER"] = "https://auth.server.mtcd.org/application/o/docsign"
        final_env = [{"name": k, "value": v} for k, v in temp_env.items()]
        payload = {
            "Name": "docsign",
            "StackFileContent": compose_content,
            "Env": final_env
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
