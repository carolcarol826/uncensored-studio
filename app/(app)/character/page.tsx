import GeneratorForm from '@/components/GeneratorForm';

export default function CharacterPage() {
  return (
    <GeneratorForm
      mode="character"
      title="角色一致性 · PuLID"
      showImageUpload
      showPulidWeight
      imageLabel="参考脸（清晰正面照效果最佳）"
      defaultBatchSize={1}
    />
  );
}
