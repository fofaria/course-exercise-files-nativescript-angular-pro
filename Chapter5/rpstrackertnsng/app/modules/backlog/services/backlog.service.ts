import { Injectable, NgZone, Inject } from '@angular/core';

import { AppConfig } from '../../../core/models/core';
import { APP_CONFIG } from '../../../config/app-config.module';

import { Store } from '../../../core/state/app-store';
import { BacklogRepository } from '../repositories/backlog.repository';

import { ServerErrorHandlerService } from '../../../core/services';
import { PtItem, PtUser } from '../../../core/models/domain';




@Injectable()
export class BacklogService {

    private get currentPreset() {
        return this.store.value.selectedPreset;
    }

    private get currentUserId() {
        if (this.store.value.currentUser) {
            return this.store.value.currentUser.id;
        } else {
            return undefined;
        }
    }

    constructor(
        @Inject(APP_CONFIG) private config: AppConfig,
        private repo: BacklogRepository,
        private store: Store,
        private errorHandlerService: ServerErrorHandlerService,
        private zone: NgZone
    ) { }

    public fetchItems() {
        return new Promise((resolve, reject) => {
            this.repo.getPtItems(
                this.currentPreset,
                this.currentUserId,
                (error) => {
                    reject(error);
                    return this.errorHandlerService.handleHttpError(error);
                },
                (ptItems: PtItem[]) => {
                    ptItems.forEach(i => {
                        this.setUserAvatarUrl(i.assignee);
                        i.comments.forEach(c => this.setUserAvatarUrl(c.user));
                    });

                    this.zone.run(() => {
                        this.store.set('backlogItems', ptItems);
                        resolve();
                    });
                }
            );
        });
    }

    public getItemFromCacheOrServer(id: number) {
        // const selectedItem = _.find(this.store.value.backlogItems, i => i.id === id);
        const selectedItem = this.store.value.backlogItems.find(i => i.id === id);
        if (selectedItem) {
            this.zone.run(() => {
                this.store.set('currentSelectedItem', selectedItem);
            });
        } else {
            this.getPtItem(id);
        }
    }

    private setUserAvatarUrl(user: PtUser) {
        user.avatar = `${this.config.apiEndpoint}/photo/${user.id}`;
    }

    public getPtItem(id: number) {
        this.repo.getPtItem(id,
            this.errorHandlerService.handleHttpError,
            (ptItem: PtItem) => {

                this.setUserAvatarUrl(ptItem.assignee);
                ptItem.comments.forEach(c => this.setUserAvatarUrl(c.user));

                this.zone.run(() => {
                    this.store.set('currentSelectedItem', ptItem);

                    // optimistically update the item list with the new item
                    const updatedItems = this.store.value.backlogItems.map((item) => {
                        return item.id === id ? ptItem : item;
                    });

                    this.store.set('backlogItems', updatedItems);
                });
            }
        );
    }

    public updatePtItem(item: PtItem) {
        this.repo.updatePtItem(item,
            this.errorHandlerService.handleHttpError,
            (updatedItem: PtItem) => {
                this.getPtItem(updatedItem.id);
            }
        );
    }

}
