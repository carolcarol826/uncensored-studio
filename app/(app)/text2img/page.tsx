import GeneratorForm from '@/components/GeneratorForm';

export default function Text2ImgPage() {
  return (
    <GeneratorForm
      mode="text2img"
      title="文生图"
      defaultBatchSize={1}
    />
  );
}
