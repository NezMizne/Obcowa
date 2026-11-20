# プロジェクト内の複数ファイルへAI出力のSEARCH/REPLACEパッチを安全に一括適用するスクリプト


# 以下のフォーマットでコード差分を出力させ、クリップボードにコピーした状態で/scripts内で実行
#
# --- FILE: path/to/file.ext ---
# <<<<<<< SEARCH
# 変更前のコード（新規作成時はこの間を空にする）
# =======
# 変更後のコード
# >>>>>>> REPLACE


from __future__ import annotations

import argparse
from dataclasses import dataclass
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


FILE_HEADER_RE = re.compile(r"^---\s*FILE:\s*(.+?)\s*---\s*$")
SEARCH_START_RE = re.compile(r"^<<<<<<<\s*SEARCH\s*$")
DIVIDER_RE = re.compile(r"^=======\s*$")
REPLACE_END_RE = re.compile(r"^>>>>>>>\s*REPLACE\s*$")


class PatchError(Exception):
    """パッチの解析・検証・適用時のエラー。"""


@dataclass(frozen=True)
class PatchBlock:
    search: str
    replace: str
    line_no: int


@dataclass(frozen=True)
class FilePatch:
    path: str
    blocks: list[PatchBlock]


@dataclass(frozen=True)
class PlannedWrite:
    target_path: Path
    display_path: str
    new_content: str
    is_new: bool
    block_count: int


def normalize_newlines(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def detect_newline(text: str) -> str:
    if "\r\n" in text:
        return "\r\n"
    return "\n"


def parse_patch_text(raw_text: str) -> list[FilePatch]:
    """AIが出力したテキストからファイルごとのSEARCH/REPLACEブロックを抽出する（純粋関数）。"""
    normalized = normalize_newlines(raw_text)
    lines = normalized.split("\n")

    file_patches: list[FilePatch] = []
    current_path: str | None = None
    current_blocks: list[PatchBlock] = []

    state = "IDLE"  # IDLE | IN_FILE | IN_SEARCH | IN_REPLACE
    search_lines: list[str] = []
    replace_lines: list[str] = []
    block_start_line = 0

    def flush_current_file() -> None:
        nonlocal current_path, current_blocks
        if current_path is not None:
            if not current_blocks:
                raise PatchError(f"ファイル '{current_path}' に変更ブロックがありません。")
            file_patches.append(FilePatch(path=current_path, blocks=current_blocks))
        current_path = None
        current_blocks = []

    for idx, line in enumerate(lines, start=1):
        if state in ("IDLE", "IN_FILE"):
            header_match = FILE_HEADER_RE.match(line)
            if header_match:
                if state == "IN_FILE":
                    flush_current_file()
                current_path = header_match.group(1).strip().strip("`\"'")
                current_blocks = []
                state = "IN_FILE"
                continue

            if state == "IN_FILE" and SEARCH_START_RE.match(line):
                state = "IN_SEARCH"
                search_lines = []
                replace_lines = []
                block_start_line = idx
                continue

        elif state == "IN_SEARCH":
            if DIVIDER_RE.match(line):
                state = "IN_REPLACE"
                continue
            search_lines.append(line)

        elif state == "IN_REPLACE":
            if REPLACE_END_RE.match(line):
                current_blocks.append(
                    PatchBlock(
                        search="\n".join(search_lines),
                        replace="\n".join(replace_lines),
                        line_no=block_start_line,
                    )
                )
                state = "IN_FILE"
                continue
            replace_lines.append(line)

    if state == "IN_SEARCH":
        raise PatchError(f"{block_start_line}行目の '<<<<<<< SEARCH' に対応する '=======' が見つかりません。")
    if state == "IN_REPLACE":
        raise PatchError(f"{block_start_line}行目のブロックに対応する '>>>>>>> REPLACE' が見つかりません。")
    if state == "IN_FILE":
        flush_current_file()

    if not file_patches:
        raise PatchError(
            "有効なパッチが見つかりませんでした。'--- FILE: パス ---' と SEARCH/REPLACE ブロックを確認してください。"
        )

    return file_patches


def apply_blocks_to_content(
    original: str | None,
    blocks: list[PatchBlock],
    display_path: str,
) -> str:
    """単一ファイルの内容に対して順番にブロックを適用した結果を返す（純粋関数）。"""
    if original is None:
        first = blocks[0]
        if first.search != "":
            raise PatchError(
                f"'{display_path}' は存在しないファイルです。新規作成する場合は最初の SEARCH ブロックを空にしてください。"
            )
        content = first.replace
        if content and not content.endswith("\n"):
            content += "\n"
        remaining_blocks = blocks[1:]
        newline_style = "\n"
    else:
        newline_style = detect_newline(original)
        content = normalize_newlines(original)
        remaining_blocks = blocks

    for block in remaining_blocks:
        if block.search == "":
            raise PatchError(
                f"'{display_path}'（{block.line_no}行目）: 既存ファイルに対して空の SEARCH ブロックは安全のため許可されていません。"
            )
        occurrences = content.count(block.search)
        if occurrences == 0:
            preview = block.search.splitlines()[0][:60] if block.search else ""
            raise PatchError(
                f"'{display_path}'（{block.line_no}行目）: SEARCH ブロックに一致する箇所が見つかりません（先頭行: {preview!r}）。"
            )
        if occurrences > 1:
            raise PatchError(
                f"'{display_path}'（{block.line_no}行目）: SEARCH ブロックが {occurrences} 箇所に一致しました。前後の行を増やして一意にしてください。"
            )
        content = content.replace(block.search, block.replace, 1)

    if newline_style == "\r\n":
        return content.replace("\n", "\r\n")
    return content


def resolve_safe_path(root_dir: Path, raw_path: str) -> Path:
    """プロジェクトルート配下の安全なパスであることを検証して返す。"""
    if not raw_path:
        raise PatchError("ファイルパスが空です。")

    candidate = Path(raw_path)
    if candidate.is_absolute():
        raise PatchError(f"絶対パスは許可されていません: '{raw_path}'")

    resolved_root = root_dir.resolve()
    resolved_target = (resolved_root / candidate).resolve()
    try:
        resolved_target.relative_to(resolved_root)
    except ValueError as exc:
        raise PatchError(f"プロジェクトルート外へのパス指定は禁止されています: '{raw_path}'") from exc

    return resolved_target


def plan_patches(root_dir: Path, file_patches: list[FilePatch]) -> list[PlannedWrite]:
    """全ファイルの読み込み・パス検証・置換シミュレーションを事前実行する。"""
    plans: list[PlannedWrite] = []
    # 同一ファイルが複数回指定された場合も正しく累積検証するため、仮想状態を保持する
    virtual_contents: dict[Path, str | None] = {}

    for file_patch in file_patches:
        target = resolve_safe_path(root_dir, file_patch.path)
        if target in virtual_contents:
            original = virtual_contents[target]
            is_new = False
        elif target.exists():
            if not target.is_file():
                raise PatchError(f"対象は通常ファイルではありません: '{file_patch.path}'")
            try:
                original = target.read_text(encoding="utf-8")
            except OSError as exc:
                raise PatchError(f"ファイル読み込みに失敗しました '{file_patch.path}': {exc}") from exc
            is_new = False
        else:
            original = None
            is_new = True

        new_content = apply_blocks_to_content(original, file_patch.blocks, file_patch.path)
        virtual_contents[target] = new_content

        plans.append(
            PlannedWrite(
                target_path=target,
                display_path=file_patch.path,
                new_content=new_content,
                is_new=is_new,
                block_count=len(file_patch.blocks),
            )
        )

    return plans


def atomic_write_text(target: Path, content: str) -> None:
    """一時ファイルへ書き込んでからリネームし、途中終了によるファイル破損を防ぐ。"""
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=target.parent,
            prefix=f".{target.name}.",
            suffix=".tmp",
            delete=False,
        ) as tmp_file:
            tmp_path = Path(tmp_file.name)
            tmp_file.write(content)
            tmp_file.flush()
            os.fsync(tmp_file.fileno())
        os.replace(tmp_path, target)
    except BaseException:
        if tmp_path is not None and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError as unlink_exc:
                print(f"警告: 一時ファイルの削除に失敗しました ({tmp_path}): {unlink_exc}", file=sys.stderr)
        raise


def read_clipboard() -> str:
    """OSごとのクリップボードからUTF-8テキストを取得する。"""
    if sys.platform == "darwin":
        cmd = ["pbpaste"]
    elif sys.platform == "win32":
        cmd = [
            "powershell",
            "-NoProfile",
            "-Command",
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard -Raw",
        ]
    else:
        for candidate in (
            ["wl-paste", "--no-newline"],
            ["xclip", "-o", "-selection", "clipboard"],
            ["xsel", "-ob"],
        ):
            try:
                res = subprocess.run(candidate, capture_output=True, text=True, encoding="utf-8", check=True)
                return res.stdout
            except FileNotFoundError:
                continue
            except subprocess.CalledProcessError as exc:
                raise PatchError(f"クリップボードの取得に失敗しました ({candidate[0]}): {exc.stderr}") from exc
        raise PatchError("Linux環境では wl-paste / xclip / xsel のいずれかが必要です。")

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", check=True)
        return res.stdout
    except FileNotFoundError as exc:
        raise PatchError(f"クリップボード取得コマンドが見つかりません: {cmd[0]}") from exc
    except subprocess.CalledProcessError as exc:
        raise PatchError(f"クリップボードの取得に失敗しました: {exc.stderr}") from exc


def read_input_text(file_arg: str | None) -> str:
    if file_arg is not None:
        path = Path(file_arg)
        if not path.is_file():
            raise PatchError(f"入力ファイルが見つかりません: '{file_arg}'")
        return path.read_text(encoding="utf-8")

    if not sys.stdin.isatty():
        return sys.stdin.read()

    return read_clipboard()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="AI出力の SEARCH/REPLACE パッチをプロジェクトへ一括適用します（引数なしはクリップボードから読込）。"
    )
    parser.add_argument("patch_file", nargs="?", help="パッチテキストファイル（省略時は標準入力またはクリップボード）")
    parser.add_argument("--dry-run", action="store_true", help="検証のみ行い、ファイルへの書き込みを行わない")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="プロジェクトルートのパス（デフォルト: スクリプトの1つ上の階層）",
    )
    parser.add_argument("--pause", action="store_true", help="終了前にEnterキー入力を待つ（ショートカット実行向け）")
    args = parser.parse_args(argv)

    root_dir: Path = args.root.resolve()

    try:
        raw_text = read_input_text(args.patch_file)
        file_patches = parse_patch_text(raw_text)
        plans = plan_patches(root_dir, file_patches)

        if args.dry_run:
            print(f"[DRY-RUN] 全ファイルの検証に成功しました（ルート: {root_dir}）：")
        else:
            for plan in plans:
                atomic_write_text(plan.target_path, plan.new_content)
            print(f"全ファイルのパッチ適用が完了しました（ルート: {root_dir}）：")

        for plan in plans:
            label = "新規作成" if plan.is_new else f"{plan.block_count}箇所置換"
            print(f"  - {plan.display_path} ({label})")
        return 0

    except PatchError as exc:
        print(f"エラー: {exc}", file=sys.stderr)
        print("※ 安全のため、ファイルは1つも変更されていません。", file=sys.stderr)
        return 1
    finally:
        if args.pause:
            input("\nEnterキーを押すと閉じます...")


if __name__ == "__main__":
    raise SystemExit(main())