import os

def walk(dirpath, prefix='', depth=0, max_depth=4, ignore={'node_modules','.git','.venv','__pycache__'}):
    if depth > max_depth:
        return
    try:
        entries = sorted(os.listdir(dirpath), key=lambda s: (not os.path.isdir(os.path.join(dirpath, s)), s.lower()))
    except Exception:
        return
    for i, name in enumerate(entries):
        if name in ignore:
            continue
        path = os.path.join(dirpath, name)
        connector = '└── ' if i == len(entries) - 1 else '├── '
        print(prefix + connector + name)
        if os.path.isdir(path):
            extension = '    ' if i == len(entries) - 1 else '│   '
            walk(path, prefix + extension, depth + 1, max_depth, ignore)

if __name__ == '__main__':
    cwd = os.getcwd()
    print(cwd)
    print('\nProject tree (depth <=4, excluding node_modules/.git):')
    walk(cwd)
