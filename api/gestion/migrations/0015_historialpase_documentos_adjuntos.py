from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestion', '0014_usuario_activo'),
    ]

    # 0001_initial ya crea la tabla gestion_historialpase_documentos_adjuntos: si esta migracion la creara de
    # nuevo, un migrate sobre una base vacia falla con "already exists". Solo actualiza el estado de Django.
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='historialpase',
                    name='documentos_adjuntos',
                    field=models.ManyToManyField(
                        blank=True,
                        related_name='historial_pases',
                        to='gestion.documentoadjunto',
                    ),
                ),
            ],
        ),
    ]
