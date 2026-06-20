import GeneratorForm from '@/components/GeneratorForm';

export default function ControlNetPage() {
  return (
    <GeneratorForm
      mode="controlnet"
      showImageUpload
      showControlType
      defaultBatchSize={1}
    />
  );
}
