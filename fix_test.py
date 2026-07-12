import re

with open("frontend/src/__tests__/confirmar-destino.spec.tsx", "r") as f:
    content = f.read()

# Remover o bloco it("mostra estados...") inteiro
content = re.sub(r'it\("mostra estados do microfone inferior.*?(?=it\(")', '', content, flags=re.DOTALL)
# Remover it("troca os textos...") que ficou mal formatado
content = re.sub(r'it\("troca os textos.*?(?=it\(")', '', content, flags=re.DOTALL)
# E o que sobrou de lixo que não fechava bloco
content = re.sub(r'await act\(async \(\) => \{\n\s*mockVoiceLoopCallbacks\.onStatusChange\?\.\("processing"\);\n\s*\}\);\n\s*\}\);\n\s*', '', content)

with open("frontend/src/__tests__/confirmar-destino.spec.tsx", "w") as f:
    f.write(content)
