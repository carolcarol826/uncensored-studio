import GeneratorForm from '@/components/GeneratorForm';

export default function Img2ImgPage() {
  return (
    <GeneratorForm
      mode="img2img"
      showImageUpload
      showDenoise
      defaultBatchSize={1}
    />
  );
}
