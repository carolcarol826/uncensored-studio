import GeneratorForm from '@/components/GeneratorForm';

export default function Text2VideoPage() {
  return (
    <GeneratorForm
      mode="text2video"
      showVideoParams
      defaultWidth={704}
      defaultHeight={480}
      defaultSteps={25}
      defaultCfg={7}
    />
  );
}
