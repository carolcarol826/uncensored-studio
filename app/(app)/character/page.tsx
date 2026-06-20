import GeneratorForm from '@/components/GeneratorForm';

export default function CharacterPage() {
  return (
    <GeneratorForm
      mode="character"
      showImageUpload
      showPulidWeight
      defaultBatchSize={1}
    />
  );
}
