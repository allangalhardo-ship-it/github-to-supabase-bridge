import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  placeholder?: string;
}

const CategorySelect: React.FC<CategorySelectProps> = ({
  value,
  onChange,
  categories,
  placeholder = 'Selecione uma categoria',
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const handleAddNew = () => {
    if (newCategory.trim()) {
      onChange(newCategory.trim());
      setNewCategory('');
      setIsAddingNew(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNew();
    }
    if (e.key === 'Escape') {
      setIsAddingNew(false);
      setNewCategory('');
    }
  };

  if (isAddingNew) {
    return (
      <div className="flex gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite a nova categoria..."
          autoFocus
          className="flex-1"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            setIsAddingNew(false);
            setNewCategory('');
          }}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleAddNew}
          disabled={!newCategory.trim()}
        >
          OK
        </Button>
      </div>
    );
  }

  return (
    <Select value={value || '__none__'} onValueChange={(v) => {
      if (v === '__add_new__') {
        setIsAddingNew(true);
      } else if (v === '__none__') {
        onChange('');
      } else {
        onChange(v);
      }
    }}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">Sem categoria</span>
        </SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat} value={cat}>
            {cat}
          </SelectItem>
        ))}
        <SelectItem value="__add_new__" className="text-primary font-medium">
          <span className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Adicionar nova...
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

export default CategorySelect;
