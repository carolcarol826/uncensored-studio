import GeneratorForm from '@/components/GeneratorForm';

export default function Img2VideoPage() {
  return (
    <GeneratorForm
      mode="img2video"
      showImageUpload
      showVideoParams
      defaultWidth={832}
      defaultHeight={480}
      defaultSteps={20}
      defaultCfg={6}
    />
  );
}
