import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Store } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1.5">
      <Store className="h-3.5 w-3.5" />
      Preços
    </Button>
  );

  const content = (
    <div className="px-1">
      <PrecosCanaisEditor
        produtoId={produtoId}
        precoBase={precoBase}
        custoInsumos={custoInsumos}
        impostoPercentual={impostoPercentual}
        onSave={() => setOpen(false)}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {trigger ?? defaultTrigger}
        </DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" />
              Preços por Canal - {produtoNome}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto pb-6 px-4">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            Preços por Canal - {produtoNome}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default PrecosCanaisDialog;
