import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const templateId = params.id;
    const body = await req.json();
    const { signerName, signerEmail, formData } = body;

    const template = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    let resolvedSignerName = signerName;
    if ((!resolvedSignerName || resolvedSignerName === "Anonymous Draft") && formData) {
      try {
        const fields = JSON.parse(template.fieldsJson) || [];
        const nameField = fields.find((f: any) => f.type === "signer_name");
        if (nameField && formData[nameField.id]) {
          resolvedSignerName = formData[nameField.id];
        }
      } catch (e) {}
    }

    // Create a new draft document in the database
    const draft = await prisma.signedDocument.create({
      data: {
        templateId: templateId,
        signerName: resolvedSignerName || "Anonymous Draft",
        signerEmail: signerEmail || "",
        formDataJson: JSON.stringify(formData || {}),
        isDraft: true,
      }
    });

    return NextResponse.json({ ok: true, draftId: draft.id });
  } catch (e: any) {
    console.error("Error creating draft document:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to create draft" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const templateId = params.id;
    const body = await req.json();
    const { draftId, signerName, signerEmail, formData } = body;

    if (!draftId) {
      return NextResponse.json({ error: "Missing draft ID." }, { status: 400 });
    }

    const existing = await prisma.signedDocument.findUnique({
      where: { id: draftId }
    });

    if (!existing) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    const template = await prisma.template.findUnique({
      where: { id: templateId }
    });

    let resolvedSignerName = signerName;
    if ((!resolvedSignerName || resolvedSignerName === "Anonymous Draft") && formData && template) {
      try {
        const fields = JSON.parse(template.fieldsJson) || [];
        const nameField = fields.find((f: any) => f.type === "signer_name");
        if (nameField && formData[nameField.id]) {
          resolvedSignerName = formData[nameField.id];
        }
      } catch (e) {}
    }

    // Update draft form responses
    const updated = await prisma.signedDocument.update({
      where: { id: draftId },
      data: {
        signerName: resolvedSignerName || existing.signerName,
        signerEmail: signerEmail || existing.signerEmail,
        formDataJson: JSON.stringify(formData || {}),
      }
    });

    return NextResponse.json({ ok: true, draftId: updated.id });
  } catch (e: any) {
    console.error("Error patching draft document:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to update draft" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get("draftId");

    if (!draftId) {
      return NextResponse.json({ error: "Missing draft ID." }, { status: 400 });
    }

    const existing = await prisma.signedDocument.findUnique({
      where: { id: draftId }
    });

    if (!existing) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    // Delete draft from DB
    await prisma.signedDocument.delete({
      where: { id: draftId }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error deleting draft document:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to delete draft" }, { status: 500 });
  }
}
