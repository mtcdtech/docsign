import fs from "fs";

export interface MicrosoftTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface SharePointItem {
  id: string;
  name: string;
  folder?: any;
  webUrl: string;
}

// Get Access Token using Client Credentials Flow
export async function getMsGraphToken(): Promise<string> {
  let tenantId = process.env.AZURE_AD_TENANT_ID || process.env.AZURE_TENANT_ID;
  let clientId = process.env.AZURE_AD_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  let clientSecret = process.env.AZURE_AD_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;

  try {
    const { prisma } = require("./prisma");
    const tenantSetting = await prisma.setting.findUnique({ where: { key: "azure_tenant_id" } });
    const clientSetting = await prisma.setting.findUnique({ where: { key: "azure_client_id" } });
    const secretSetting = await prisma.setting.findUnique({ where: { key: "azure_client_secret" } });

    if (tenantSetting?.value) tenantId = tenantSetting.value;
    if (clientSetting?.value) clientId = clientSetting.value;
    if (secretSetting?.value) clientSecret = secretSetting.value;
  } catch (err) {
    console.warn("Could not query Azure credentials from DB settings, falling back to process.env:", err);
  }

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph credentials are not configured in the database settings or environment.");
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to obtain MS Graph Token: ${res.status} - ${errText}`);
  }

  const data = (await res.json()) as MicrosoftTokenResponse;
  return data.access_token;
}

// Find SharePoint Sites
export async function listSharepointSites(token: string, search: string = ""): Promise<SharePointItem[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const url = `https://graph.microsoft.com/v1.0/sites${query}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list SharePoint sites: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.value || []).map((s: any) => ({
    id: s.id,
    name: s.displayName || s.name,
    webUrl: s.webUrl,
  }));
}

// List Drives (Document Libraries) on a Site
export async function listSiteDrives(token: string, siteId: string): Promise<SharePointItem[]> {
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list site drives: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.value || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    webUrl: d.webUrl,
  }));
}

// List Folders inside a specific Drive and Folder ID
export async function listDriveFolders(token: string, driveId: string, folderId: string = "root"): Promise<SharePointItem[]> {
  const pathPart = folderId === "root" ? "root/children" : `items/${folderId}/children`;
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/${pathPart}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list drive folder items: ${res.statusText}`);
  }

  const data = await res.json();
  // Filter for folder items only
  const items = data.value || [];
  return items
    .filter((item: any) => item.folder !== undefined)
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      webUrl: item.webUrl,
    }));
}

// Upload file to SharePoint folder
export async function uploadFileToSharepoint(
  token: string,
  driveId: string,
  folderId: string,
  filePath: string,
  fileName: string
): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const pathPart = folderId === "root" ? `root:/${fileName}:/content` : `items/${folderId}:/${fileName}:/content`;
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/${pathPart}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/pdf",
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SharePoint PDF upload failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  return data.webUrl || "";
}

// Fetch details for a specific drive item
export async function getDriveItemDetails(token: string, driveId: string, itemId: string = "root"): Promise<{ id: string; name: string; webUrl: string }> {
  const url = itemId === "root" || itemId.endsWith("/root")
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root`
    : `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get drive item details: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    webUrl: data.webUrl,
  };
}
