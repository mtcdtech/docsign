# Web App Integration Guide: Exposing User Roles for IAM Sync

To integrate an external web application with the church's Identity & Access Management (IAM) module, the developer needs to expose a single, secure REST API endpoint. This endpoint allows the Admin Portal to fetch all user roles (types) defined in the application.

## 1. The HTTP Endpoint

Expose the following GET endpoint in the web application:
- Path: GET /api/iam/roles
- Authentication: (Recommended) Bearer Token header authentication.

### Headers:
Accept: application/json
Authorization: Bearer <Your-Configured-Secret-Token>

## 2. Expected JSON Response Schema

The response must be a JSON object with a single root key "roles", containing an array of objects. Each role object must have:
- "id": A unique string identifier for the role (used internally for group syncing).
- "name": A friendly name displayed to the administrator.
- "description": (Optional) A brief description of what this role allows.

Example Response:
{
  "roles": [
    {
      "id": "admin",
      "name": "Administrator",
      "description": "Full access to settings and user management."
    },
    {
      "id": "vicar",
      "name": "Vicar",
      "description": "Access to pastoral administration features."
    },
    {
      "id": "member",
      "name": "Standard Member",
      "description": "Access to public dashboards and profile settings."
    }
  ]
}

## 3. How Syncing Works in Authentik

1. Role Definition: The Admin Portal reads these roles and displays them as columns.
2. Group Sync: The Portal maps church members, AD groups, and PCO lists to these roles, then synchronizes them to Authentik as OIDC groups named:
   app_<webapp_slug>_<role_id>  (e.g., app_nextcloud_admin, app_nextcloud_vicar).
3. Access Control: When logging in via SSO, your webapp can parse the OIDC 'groups' claim and auto-assign permissions matching the suffix.