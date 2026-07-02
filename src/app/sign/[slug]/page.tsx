import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SignForm from "./SignForm";

export const dynamic = "force-dynamic";

interface SignPageProps {
  params: {
    slug: string;
  };
}

export default async function SignPage({ params }: SignPageProps) {
  const { slug } = params;

  const template = await prisma.template.findUnique({
    where: { slug },
    include: {
      organization: true,
    },
  });

  if (!template) {
    notFound();
  }

  return (
    <main style={{ padding: "20px", display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ flex: 1 }}>
        <SignForm template={template} />
      </div>
    </main>
  );
}
