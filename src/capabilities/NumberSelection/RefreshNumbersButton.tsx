import { Button, Icon, REFRESH_ALT } from 'dxp-ui';

/** The Refresh action in the step's title row: reads the number inventory again. The portal's step card carries the same one. */
export function RefreshNumbersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <Icon path={REFRESH_ALT} className="size-4 " />
      Refresh
    </Button>
  );
}
