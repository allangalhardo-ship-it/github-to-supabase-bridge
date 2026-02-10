import React from 'react';
import { Button } from '@/components/ui/button';
import { Store } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';
import PrecosCanaisEditor from './PrecosCanaisEditor';

interface PrecosCanaisDialogProps {
  produtoId: string;
  produtoNome: string;
  precoBase: number;
  custoInsumos: number;
  impostoPercentual?: number;
  trigger?: React.ReactNode;
}

const PrecosCanaisDialog: React.FC<PrecosCanaisDialogProps> = ({
  produtoId,
  produtoNome,
  precoBase,
  custoInsumos,
  impostoPercentual = 0,
  trigger,
}) => {
  const [open, setOpen] = React.useState(false);

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1.5">
      <Store className="h-3.5 w-3.5" />
      Preços
    </Button>
  );

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            Preços por Canal - {produtoNome}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <PrecosCanaisEditor
            produtoId={produtoId}
            precoBase={precoBase}
            custoInsumos={custoInsumos}
            impostoPercentual={impostoPercentual}
            onSave={() => setOpen(false)}
          />
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};

export default PrecosCanaisDialog;
