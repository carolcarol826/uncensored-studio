import GeneratorForm from '@/components/GeneratorForm';

export default function ControlNetPage() {
  return (
    <GeneratorForm
      mode="controlnet"
      title="姿势 / 构图控制 · ControlNet"
      showImageUpload
      showControlType
      imageLabel="参考图（姿势 / 场景 / 构图来源）"
      defaultBatchSize={1}
    />
  );
}
