// The existing JavaScript primitives infer incomplete forwardRef props under checkJs.
// Keep this compatibility boundary local to the account screens.
import * as Buttons from '@/components/ui/button';
import * as Inputs from '@/components/ui/input';
import * as Labels from '@/components/ui/label';
import * as Dialogs from '@/components/ui/dialog';
import * as Selects from '@/components/ui/select';
import * as TabsGroup from '@/components/ui/tabs';
import * as Menus from '@/components/ui/dropdown-menu';
import * as Cards from '@/components/ui/card';
import * as Avatars from '@/components/ui/avatar';
import * as Checkboxes from '@/components/ui/checkbox';
/** @returns {import('react').ComponentType<any>} */
const component = value => value;
export const Button=component(Buttons.Button),Input=component(Inputs.Input),Label=component(Labels.Label);
export const Dialog=component(Dialogs.Dialog),DialogContent=component(Dialogs.DialogContent);
export const DialogHeader=component(Dialogs.DialogHeader),DialogTitle=component(Dialogs.DialogTitle),DialogFooter=component(Dialogs.DialogFooter);
export const Select=component(Selects.Select),SelectContent=component(Selects.SelectContent),SelectItem=component(Selects.SelectItem);
export const SelectTrigger=component(Selects.SelectTrigger),SelectValue=component(Selects.SelectValue);
export const Tabs=component(TabsGroup.Tabs),TabsContent=component(TabsGroup.TabsContent);
export const TabsList=component(TabsGroup.TabsList),TabsTrigger=component(TabsGroup.TabsTrigger);
export const DropdownMenu=component(Menus.DropdownMenu),DropdownMenuContent=component(Menus.DropdownMenuContent);
export const DropdownMenuItem=component(Menus.DropdownMenuItem),DropdownMenuTrigger=component(Menus.DropdownMenuTrigger);
export const Card=component(Cards.Card),CardContent=component(Cards.CardContent),CardHeader=component(Cards.CardHeader),CardTitle=component(Cards.CardTitle);

export const Avatar=component(Avatars.Avatar),AvatarFallback=component(Avatars.AvatarFallback),Checkbox=component(Checkboxes.Checkbox);

export const DialogDescription=component(Dialogs.DialogDescription);
