"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function LoginDialog({
  open,
  onOpenChange,
  onLoggedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoggedIn: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.login(password);
      setPassword("");
      onLoggedIn();
      onOpenChange(false);
      toast.success("관리자로 로그인했습니다.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading">관리자 로그인</DialogTitle>
            <DialogDescription>차를 등록·수정하려면 비밀번호를 입력하세요.</DialogDescription>
          </DialogHeader>
          <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" />
          <DialogFooter>
            <Button type="submit" disabled={busy || !password}>
              {busy && <Loader2 className="animate-spin" />}
              로그인
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
