import { useEffect } from 'react';
import { Card } from 'dxp-ui';
import { handOverHomeToRfs } from './productChoice';
import type { ProductStepContext } from './ProductSelection';

/** Back or Edit landed here: go to Check RFS, as the New Home card does (the journey's draft and customer hold are released, what is known goes along in the router state). */
export function BackToCheckRfs({ ctx, values }: { ctx: ProductStepContext; values: Record<string, unknown> }) {
  useEffect(() => {
    handOverHomeToRfs(ctx, values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Card className="p-6" role="status">
      <p className="text-secondary">Returning to Check RFS…</p>
    </Card>
  );
}
