import { ProjectTemplateWizard } from "../../../../components/ProjectTemplateWizard";
export default async function TemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <ProjectTemplateWizard templateId={templateId} />;
}
