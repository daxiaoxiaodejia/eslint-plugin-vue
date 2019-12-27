<!--{"parserOptions": {"parser":"@typescript-eslint/parser"}}-->
<script>
obj
  ?.aaa
  ?.bbb
  ?.ccc;

obj?.
  aaa?.
  bbb?.
  ccc;

obj?.
  [aaa]?.
  [bbb]
  ?.[ccc];

obj?.
  (
    aaa
  )?.
  (
    bbb
  )
  ?.(
    ccc
  )
</script>
