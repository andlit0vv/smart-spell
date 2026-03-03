interface Props {
  title: string;
}

const PlaceholderScreen = ({ title }: Props) => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <p className="text-lg font-medium text-muted-foreground">{title}</p>
  </div>
);

export default PlaceholderScreen;
