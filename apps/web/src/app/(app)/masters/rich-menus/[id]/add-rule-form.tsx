import { Button } from "@/components/ui/button";
import { addRichMenuRule } from "../actions";

export function AddRuleForm({
  richMenuId,
  tags,
}: {
  richMenuId: string;
  tags: { id: string; name: string }[];
}) {
  return (
    <form action={addRichMenuRule.bind(null, richMenuId)} className="flex items-end gap-2">
      <select
        name="tag_id"
        aria-label="追加するタグ"
        className="h-9 w-48 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm">
        ルールを追加
      </Button>
    </form>
  );
}
